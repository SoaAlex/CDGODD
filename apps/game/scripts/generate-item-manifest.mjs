// Fetches the approved-item catalog + categories from the API and writes
// src/generated/item-manifest.json, consumed by the /item/[id], /items,
// /categorie/[key] and /classements routes so `expo export` prerenders one
// crawlable HTML page per item and per category.
//
// Indexing hygiene (AdSense/SEO):
//  - the deck is fetched with `exclude=nsfw` so sensitive items never get a
//    prerendered page, a sitemap entry or an ad-tagged URL (they stay
//    playable in-game through the category filters);
//  - a small label blocklist backstops items that should carry the nsfw
//    category but don't (e.g. #261 "Drogues" slipped through the first
//    review build) — the real fix is tagging them in the admin panel;
//  - items whose label is shorter than 3 characters are dropped (junk data)
//    and logged so they can be cleaned up in the admin panel.
//
// Runs before `expo export` in `build:web`. MUST fail soft: the e2e CI job
// builds the web bundle before any API server exists, and a network hiccup
// should never break a deploy — on any error we keep the existing manifest
// (or write an empty one) and exit 0; the site then simply ships without
// prerendered item pages.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';
const OUT = fileURLToPath(
  new URL('../src/generated/item-manifest.json', import.meta.url),
);
// Backstop against a runaway cursor loop; also the Workers static-asset
// file-count ceiling is 20k, so more item pages could not deploy anyway.
const MAX_ITEMS = 15000;
const EXCLUDED_CATEGORIES = ['nsfw'];
// Backstop for items missing the nsfw tag: an ad-tagged page on adult/drug
// content is an AdSense violation, so keep these out of the index even when
// the category data is wrong. Keep the list tight — it silently unpublishes
// pages, and legitimate topics (e.g. "sexisme") must not match.
const EXCLUDED_LABEL_PATTERNS = [/drogue/i, /porno/i, /\bsexe\b/i, /nazi/i];
const MIN_LABEL_LENGTH = 3;

function slugify(label) {
  return (
    label
      // NFD leaves ligatures alone, so expand them first (bœuf -> boeuf).
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .replace(/Œ/g, 'oe')
      .replace(/Æ/g, 'ae')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics
      .toLowerCase()
      // "C++" -> "c-plus-plus" rather than the junk-looking bare "c"
      .replace(/\+/g, '-plus')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      // keep URLs short even for long labels
      .slice(0, 60)
      .replace(/-+$/, '') || 'item'
  );
}

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GET ${path.split('?')[0]} -> ${res.status}`);
  return res.json();
}

async function fetchAllCards() {
  const cards = [];
  let cursor;
  do {
    const params = new URLSearchParams({ lang: 'fr', limit: '50' });
    params.set('exclude', EXCLUDED_CATEGORIES.join(','));
    if (cursor !== undefined) params.set('cursor', String(cursor));
    const page = await fetchJson(`/deck?${params}`);
    cards.push(...page.cards);
    cursor = page.nextCursor;
  } while (cursor !== undefined && cards.length < MAX_ITEMS);
  return cards;
}

function hasExistingManifest() {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8')).items.length > 0;
  } catch {
    return false;
  }
}

try {
  const [cards, categoriesResponse] = await Promise.all([
    fetchAllCards(),
    fetchJson('/categories?lang=fr'),
  ]);

  const junk = [];
  const sensitive = [];
  const kept = [];
  for (const c of cards) {
    if (c.label.trim().length < MIN_LABEL_LENGTH) junk.push(c);
    else if (EXCLUDED_LABEL_PATTERNS.some((p) => p.test(c.label)))
      sensitive.push(c);
    else kept.push(c);
  }
  if (junk.length > 0) {
    console.warn(
      `item manifest: skipping ${junk.length} junk item(s) with too-short labels: ` +
        junk.map((c) => `#${c.id} "${c.label}"`).join(', '),
    );
  }
  if (sensitive.length > 0) {
    console.warn(
      `item manifest: skipping ${sensitive.length} sensitive-label item(s) (tag them nsfw in the admin): ` +
        sensitive.map((c) => `#${c.id} "${c.label}"`).join(', '),
    );
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    categories: categoriesResponse.categories
      .filter((c) => !EXCLUDED_CATEGORIES.includes(c.key))
      .map((c) => ({ key: c.key, name: c.name, count: c.count })),
    items: kept.map((c) => ({
      id: c.id,
      seg: `${c.id}-${slugify(c.label)}`,
      label: c.label,
      imageUrl: c.imageUrl ?? null,
      votesLeft: c.votesLeft,
      votesRight: c.votesRight,
      categoryKeys: c.categoryKeys,
    })),
  };
  writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `item manifest: ${manifest.items.length} items, ${manifest.categories.length} categories from ${API_BASE}`,
  );
} catch (err) {
  console.warn(
    `item manifest: could not fetch from ${API_BASE} (${err?.message ?? err}); ` +
      (hasExistingManifest()
        ? 'keeping the existing manifest.'
        : 'writing an empty manifest — no item pages will be prerendered.'),
  );
  if (!hasExistingManifest()) {
    writeFileSync(
      OUT,
      `${JSON.stringify({ generatedAt: null, categories: [], items: [] }, null, 2)}\n`,
    );
  }
}
