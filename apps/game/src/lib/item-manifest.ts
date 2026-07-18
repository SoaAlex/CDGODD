import type { DeckCard } from '@cdgodd/shared';
import manifest from '@/generated/item-manifest.json';

/**
 * Build-time snapshot of the approved item catalog, written by
 * `scripts/generate-item-manifest.mjs` before `expo export` so the /item/[id]
 * and /items routes can be prerendered into static HTML. The committed file is
 * an empty placeholder; CI overwrites it (in the working tree only) with prod
 * data. Vote counts are a snapshot — screens refresh them via /items/tallies
 * after hydration.
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

const items = (manifest as { items: ManifestItem[] }).items;

export const MANIFEST_GENERATED_AT = (
  manifest as { generatedAt: string | null }
).generatedAt;

export function getItems(): ManifestItem[] {
  return items;
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
