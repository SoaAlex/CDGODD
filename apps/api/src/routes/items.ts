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
  votes_left: number;
  votes_right: number;
  /** GROUP_CONCAT of category keys — keys are [a-z0-9-] so ',' is safe. */
  category_keys: string | null;
}

/** Correlated subquery aggregating an item's category keys into a CSV. */
export const CATEGORY_KEYS_SQL = `
  (SELECT GROUP_CONCAT(c.key)
     FROM item_categories ic
     JOIN categories c ON c.id = ic.category_id
    WHERE ic.item_id = i.id) AS category_keys`;

function toCard(row: DeckRow, cdnBase: string): DeckCard {
  return {
    id: row.id,
    label: row.label,
    categoryKeys: row.category_keys ? row.category_keys.split(',') : [],
    imageUrl: row.image_key ? `${cdnBase}/${row.image_key}` : null,
    votesLeft: row.votes_left,
    votesRight: row.votes_right,
  };
}

/**
 * GET /deck?lang=fr&cursor=0&limit=25
 * Batch of approved items for the swipe deck. Client prefetches images
 * for the next 3-5 cards and refetches when ~5 cards remain.
 */
items.get('/deck', async (c) => {
  const parsed = deckQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'bad query' }, 400);
  const { lang, cursor = 0, limit } = parsed.data;

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, t.label, i.image_key, i.votes_left, i.votes_right, ${CATEGORY_KEYS_SQL}
       FROM items i
       JOIN item_translations t ON t.item_id = i.id AND t.lang = ?1
      WHERE i.status = 'approved' AND i.id > ?2
      ORDER BY i.id
      LIMIT ?3`,
  )
    .bind(lang, cursor, limit)
    .all<DeckRow>();

  const cards = results.map((r) => toCard(r, c.env.CDN_BASE));
  const body: DeckResponse = { cards };
  if (cards.length === limit) body.nextCursor = cards[cards.length - 1]!.id;
  return c.json(body);
});

/** GET /categories?lang=fr — localized category list (submit form, admin). */
items.get('/categories', async (c) => {
  const lang = c.req.query('lang') ?? 'fr';
  const { results } = await c.env.DB.prepare(
    `SELECT c.key, ct.name
       FROM categories c
       JOIN category_translations ct ON ct.category_id = c.id AND ct.lang = ?1
      ORDER BY ct.name`,
  )
    .bind(lang)
    .all<{ key: string; name: string }>();
  return c.json({ categories: results });
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
    `SELECT i.id, t.label, i.image_key, i.votes_left, i.votes_right, ${CATEGORY_KEYS_SQL}
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
