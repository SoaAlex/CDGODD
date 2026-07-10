import { Hono } from 'hono';
import {
  deckQuerySchema,
  searchQuerySchema,
  type DeckCard,
  type DeckResponse,
  type SearchResponse,
} from '@cdgodd/shared';
import type { AppContext } from '../env';

const items = new Hono<AppContext>();

interface DeckRow {
  id: number;
  label: string;
  image_key: string | null;
  image_author: string | null;
  image_license: string | null;
  image_source_url: string | null;
  votes_left: number;
  votes_right: number;
  /** GROUP_CONCAT of category keys — keys are [a-z0-9-] so ',' is safe. */
  category_keys: string | null;
  /** Value the deck is ordered by — the opaque keyset cursor for the next page. */
  sort_key: number;
}

/**
 * Prime modulus for the shuffle permutation. The order key is
 * `(id * mix(seed)) % SHUFFLE_MOD`, a bijection over item ids (P prime,
 * mix(seed) never 0 mod P, every id < P), so distinct ids get distinct keys
 * and keyset pagination never skips or repeats a card within a session.
 */
const SHUFFLE_MOD = 1_000_000_007;

/**
 * Knuth multiplicative constant (2^32 · golden ratio), used to diffuse the raw
 * seed before it becomes the permutation multiplier.
 */
const SHUFFLE_MIX = 2_654_435_761;
/**
 * Half the modulus. The multiplier is forced into `[SHUFFLE_HALF, P)` — always
 * greater than P/2 — so `id * m` wraps the modulus for every id ≥ 2 and the
 * order scatters even for the small, consecutive ids this deck has. A plain
 * `id * seed` (or an un-clamped diffused seed) stays in ascending id order
 * whenever the multiplier happens to fall below P / itemCount, which is why the
 * multiplier is clamped high rather than left to chance.
 */
const SHUFFLE_HALF = 500_000_003;

/** Correlated subquery aggregating an item's category keys into a CSV. */
export const CATEGORY_KEYS_SQL = `
  (SELECT GROUP_CONCAT(c.key)
     FROM item_categories ic
     JOIN categories c ON c.id = ic.category_id
    WHERE ic.item_id = i.id) AS category_keys`;

/**
 * `AND i.id IN (…)` clause restricting items to a set of category keys.
 * Keys are bound as ?N, ?N+1, … — pass them to .bind() in the same order.
 * matchAll = items must belong to every key (default: at least one).
 */
export function categoryFilterSql(
  keys: string[],
  firstParam: number,
  matchAll = false,
): string {
  if (keys.length === 0) return '';
  const placeholders = keys.map((_, i) => `?${firstParam + i}`).join(',');
  // keys.length is a trusted integer (never user text) — safe to inline.
  const having = matchAll
    ? `GROUP BY ic.item_id
                       HAVING COUNT(DISTINCT c.key) = ${keys.length}`
    : '';
  return `AND i.id IN (SELECT ic.item_id
                         FROM item_categories ic
                         JOIN categories c ON c.id = ic.category_id
                        WHERE c.key IN (${placeholders})
                        ${having})`;
}

function toCard(row: DeckRow, cdnBase: string): DeckCard {
  return {
    id: row.id,
    label: row.label,
    categoryKeys: row.category_keys ? row.category_keys.split(',') : [],
    imageUrl: row.image_key ? `${cdnBase}/${row.image_key}` : null,
    imageAttribution: row.image_license
      ? {
          author: row.image_author,
          license: row.image_license,
          sourceUrl: row.image_source_url,
        }
      : null,
    votesLeft: row.votes_left,
    votesRight: row.votes_right,
  };
}

/**
 * GET /deck?lang=fr&cursor=0&limit=25&seed=12345
 * Batch of approved items for the swipe deck. Client prefetches images
 * for the next 3-5 cards and refetches when ~5 cards remain.
 *
 * With `seed` the deck is ordered by a per-session permutation of item ids so
 * each session sees a fresh order; `cursor` is then the opaque `sort_key` of
 * the last card. Without `seed` the order is ascending id (legacy). Either way
 * the cursor is just `nextCursor` echoed back, and already-swiped cards are
 * filtered on-device (see apps/game seen.ts) to keep the API stateless.
 */
items.get('/deck', async (c) => {
  const parsed = deckQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'bad query' }, 400);
  const { lang, cursor = 0, limit, categories = [], match, seed } = parsed.data;

  // Ordering key doubles as the keyset cursor. Both the shuffle and legacy
  // paths order by a value strictly greater than `cursor` and echo the last
  // row's value as `nextCursor`. seed is bound as ?4, so category placeholders
  // start one slot later when it is present.
  // Permutation multiplier m = mix(seed) clamped to the upper half of the
  // modulus, then key = (id * m) % P. m is coprime to the prime P, so id -> key
  // is a bijection: distinct ids get distinct keys, keeping keyset pagination
  // exact while m > P/2 guarantees the order is actually shuffled.
  const orderKey =
    seed !== undefined
      ? `(i.id * (((?4 * ${SHUFFLE_MIX}) % ${SHUFFLE_HALF}) + ${SHUFFLE_HALF})) % ${SHUFFLE_MOD}`
      : `i.id`;
  const catFirstParam = seed !== undefined ? 5 : 4;

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, t.label, i.image_key, i.image_author, i.image_license,
            i.image_source_url, i.votes_left, i.votes_right, ${CATEGORY_KEYS_SQL},
            ${orderKey} AS sort_key
       FROM items i
       JOIN item_translations t ON t.item_id = i.id AND t.lang = ?1
      WHERE i.status = 'approved' AND ${orderKey} > ?2
      ${categoryFilterSql(categories, catFirstParam, match === 'all')}
      ORDER BY ${orderKey}
      LIMIT ?3`,
  )
    .bind(
      lang,
      cursor,
      limit,
      ...(seed !== undefined ? [seed] : []),
      ...categories,
    )
    .all<DeckRow>();

  const cards = results.map((r) => toCard(r, c.env.CDN_BASE));
  const body: DeckResponse = { cards };
  // sort_key == id on the legacy path, so this covers both orderings.
  if (cards.length === limit)
    body.nextCursor = results[results.length - 1]!.sort_key;
  return c.json(body);
});

/** GET /categories?lang=fr — localized category list (submit form, admin). */
items.get('/categories', async (c) => {
  const lang = c.req.query('lang') ?? 'fr';
  const [{ results }, totalRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT c.key, ct.name,
              (SELECT COUNT(*)
                 FROM item_categories ic
                 JOIN items i ON i.id = ic.item_id AND i.status = 'approved'
                WHERE ic.category_id = c.id) AS count
         FROM categories c
         JOIN category_translations ct ON ct.category_id = c.id AND ct.lang = ?1
        ORDER BY ct.name`,
    )
      .bind(lang)
      .all<{ key: string; name: string; count: number }>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM items WHERE status = 'approved'`,
    ).first<{ total: number }>(),
  ]);
  return c.json({ categories: results, total: totalRow?.total ?? 0 });
});

/**
 * GET /items/tallies?ids=1,2,3 — current global tallies for a set of items
 * (history page refreshes its locally-stored votes with these).
 */
items.get('/items/tallies', async (c) => {
  const ids = (c.req.query('ids') ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100);
  if (ids.length === 0) return c.json({ tallies: [] });

  const placeholders = ids.map((_, i) => `?${i + 1}`).join(',');
  const { results } = await c.env.DB.prepare(
    `SELECT id AS itemId, votes_left AS votesLeft, votes_right AS votesRight
       FROM items WHERE id IN (${placeholders})`,
  )
    .bind(...ids)
    .all();
  return c.json({ tallies: results });
});

/** GET /items/search?q=…&lang=fr — free-search mode. */
items.get('/items/search', async (c) => {
  const parsed = searchQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'bad query' }, 400);
  const { q, lang } = parsed.data;

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, t.label, i.image_key, i.image_author, i.image_license,
            i.image_source_url, i.votes_left, i.votes_right, ${CATEGORY_KEYS_SQL}
       FROM items i
       JOIN item_translations t ON t.item_id = i.id AND t.lang = ?1
      WHERE i.status = 'approved' AND t.label LIKE ?2
      ORDER BY t.label
      LIMIT 20`,
  )
    .bind(lang, `%${q}%`)
    .all<DeckRow>();

  const body: SearchResponse = {
    results: results.map((r) => toCard(r, c.env.CDN_BASE)),
  };
  return c.json(body);
});

export default items;
