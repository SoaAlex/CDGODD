// Fetches the full approved-item catalog from the API and writes
// src/generated/item-manifest.json, consumed by the /item/[id] and /items
// routes so `expo export` prerenders one crawlable HTML page per item.
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
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      // keep URLs short even for long labels
      .slice(0, 60)
      .replace(/-+$/, '') || 'item'
  );
}

async function fetchAllCards() {
  const cards = [];
  let cursor;
  do {
    const params = new URLSearchParams({ lang: 'fr', limit: '50' });
    if (cursor !== undefined) params.set('cursor', String(cursor));
    const res = await fetch(`${API_BASE}/deck?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`GET /deck -> ${res.status}`);
    const page = await res.json();
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
  const cards = await fetchAllCards();
  const manifest = {
    generatedAt: new Date().toISOString(),
    items: cards.map((c) => ({
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
  console.log(`item manifest: ${manifest.items.length} items from ${API_BASE}`);
} catch (err) {
  console.warn(
    `item manifest: could not fetch ${API_BASE}/deck (${err?.message ?? err}); ` +
      (hasExistingManifest()
        ? 'keeping the existing manifest.'
        : 'writing an empty manifest — no item pages will be prerendered.'),
  );
  if (!hasExistingManifest()) {
    writeFileSync(OUT, `${JSON.stringify({ generatedAt: null, items: [] }, null, 2)}\n`);
  }
}
