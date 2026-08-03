import type { DeckCard } from '@cdgodd/shared';
import manifest from '@/generated/item-manifest.json';

/**
 * Build-time snapshot of the approved item catalog (and its categories),
 * written by `scripts/generate-item-manifest.mjs` before `expo export` so
 * the /item/[id], /items, /categorie/[key] and /classements routes can be
 * prerendered into static HTML. The committed file is an empty placeholder;
 * CI overwrites it (in the working tree only) with prod data. Vote counts
 * are a snapshot — screens refresh them via /items/tallies after hydration.
 *
 * The stats helpers below are what makes each prerendered page unique
 * (ranks, neighbours, top lists): all deterministic, computed once and
 * cached at module level.
 */
export interface ManifestItem {
  id: number;
  /** URL segment: `<id>-<slugified-fr-label>`, e.g. `42-le-quinoa`. */
  seg: string;
  label: string;
  imageUrl: string | null;
  votesLeft: number;
  votesRight: number;
  categoryKeys: string[];
}

export interface ManifestCategory {
  key: string;
  name: string;
  count: number;
}

const items = (manifest as { items: ManifestItem[] }).items;
const categories = (manifest as { categories: ManifestCategory[] })
  .categories;

export const MANIFEST_GENERATED_AT = (
  manifest as { generatedAt: string | null }
).generatedAt;

export function getItems(): ManifestItem[] {
  return items;
}

export function getCategories(): ManifestCategory[] {
  return categories;
}

/** French category name from the build snapshot; undefined when the key
 * isn't in the manifest (callers then fall back to the runtime hook). */
export function manifestCategoryName(key: string): string | undefined {
  return categories.find((c) => c.key === key)?.name;
}

/** Look up by URL segment (or a bare id): only the leading integer counts,
 * so stale/partial slugs still resolve to the right item. */
export function findItem(idOrSeg: string): ManifestItem | undefined {
  const id = Number.parseInt(idOrSeg, 10);
  if (!Number.isFinite(id)) return undefined;
  return items.find((i) => i.id === id);
}

export function toDeckCard(item: ManifestItem): DeckCard {
  return {
    id: item.id,
    label: item.label,
    categoryKeys: item.categoryKeys,
    imageUrl: item.imageUrl,
    votesLeft: item.votesLeft,
    votesRight: item.votesRight,
  };
}

export function totalVotes(item: ManifestItem): number {
  return item.votesLeft + item.votesRight;
}

/** Share of left votes in percent (0-100); 50 for unvoted items. */
export function leftPct(item: ManifestItem): number {
  const total = totalVotes(item);
  return total > 0 ? Math.round((item.votesLeft / total) * 100) : 50;
}

/** All voted items ordered most-left -> most-right. Ties break by vote
 * count (more votes first) then id, so the ordering is deterministic. */
let votedByLeftness: ManifestItem[] | null = null;
function getVotedByLeftness(): ManifestItem[] {
  votedByLeftness ??= items
    .filter((i) => totalVotes(i) > 0)
    .sort(
      (a, b) =>
        leftPctExact(b) - leftPctExact(a) ||
        totalVotes(b) - totalVotes(a) ||
        a.id - b.id,
    );
  return votedByLeftness;
}

function leftPctExact(item: ManifestItem): number {
  const total = totalVotes(item);
  return total > 0 ? item.votesLeft / total : 0.5;
}

export interface Rank {
  rank: number;
  total: number;
}

/** 1-based position in the most-left -> most-right ordering across all
 * voted items; undefined for unvoted items. */
export function overallRank(item: ManifestItem): Rank | undefined {
  const ordered = getVotedByLeftness();
  const at = ordered.findIndex((i) => i.id === item.id);
  if (at === -1) return undefined;
  return { rank: at + 1, total: ordered.length };
}

/** Same ordering restricted to one category. */
export function rankInCategory(
  item: ManifestItem,
  categoryKey: string,
): Rank | undefined {
  const ordered = getVotedByLeftness().filter((i) =>
    i.categoryKeys.includes(categoryKey),
  );
  const at = ordered.findIndex((i) => i.id === item.id);
  if (at === -1) return undefined;
  return { rank: at + 1, total: ordered.length };
}

/** Adjacent items in the global leftness ordering: the one just left of
 * this item and the one just right of it. */
export function neighbours(item: ManifestItem): {
  moreLeft?: ManifestItem;
  moreRight?: ManifestItem;
} {
  const ordered = getVotedByLeftness();
  const at = ordered.findIndex((i) => i.id === item.id);
  if (at === -1) return {};
  return { moreLeft: ordered[at - 1], moreRight: ordered[at + 1] };
}

/** Items of one category, ranked most-left -> most-right (voted first,
 * then unvoted by id) — the category page's list. */
export function categoryItemsRanked(categoryKey: string): ManifestItem[] {
  const voted = getVotedByLeftness().filter((i) =>
    i.categoryKeys.includes(categoryKey),
  );
  const unvoted = items.filter(
    (i) => i.categoryKeys.includes(categoryKey) && totalVotes(i) === 0,
  );
  return [...voted, ...unvoted];
}

export function topMostLeft(n: number): ManifestItem[] {
  return getVotedByLeftness().slice(0, n);
}

export function topMostRight(n: number): ManifestItem[] {
  return getVotedByLeftness().slice(-n).reverse();
}

/** Closest to a 50/50 split, minimum 5 votes so tiny samples don't rank. */
export function mostDivisive(n: number): ManifestItem[] {
  return items
    .filter((i) => totalVotes(i) >= 5)
    .sort(
      (a, b) =>
        Math.abs(0.5 - leftPctExact(a)) - Math.abs(0.5 - leftPctExact(b)) ||
        totalVotes(b) - totalVotes(a) ||
        a.id - b.id,
    )
    .slice(0, n);
}

export function mostVoted(n: number): ManifestItem[] {
  return [...items]
    .sort((a, b) => totalVotes(b) - totalVotes(a) || a.id - b.id)
    .slice(0, n);
}

/** Labels that appear more than once in the catalog (e.g. two "Avocat"
 * items) get their category appended in titles to stay distinguishable. */
let labelCounts: Map<string, number> | null = null;
export function isAmbiguousLabel(item: ManifestItem): boolean {
  if (!labelCounts) {
    labelCounts = new Map();
    for (const i of items) {
      const key = i.label.toLowerCase();
      labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
    }
  }
  return (labelCounts.get(item.label.toLowerCase()) ?? 0) > 1;
}
