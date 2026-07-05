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
  category_key: string | null;
}

function toCard(row: DeckRow, cdnBase: string): DeckCard {
  return {
    id: row.id,
    label: row.label,
    categoryKey: row.category_key,
    imageUrl: row.image_key ? `${cdnBase}/${row.image_key}` : null,
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
    `SELECT i.id, t.label, i.image_key, cat.key AS category_key
       FROM items i
       JOIN item_translations t ON t.item_id = i.id AND t.lang = ?1
       LEFT JOIN categories cat ON cat.id = i.category_id
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

/** GET /items/search?q=…&lang=fr — free-search mode. */
items.get('/items/search', async (c) => {
  const parsed = searchQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'bad query' }, 400);
  const { q, lang } = parsed.data;

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, t.label, i.image_key, cat.key AS category_key
       FROM items i
       JOIN item_translations t ON t.item_id = i.id AND t.lang = ?1
       LEFT JOIN categories cat ON cat.id = i.category_id
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
