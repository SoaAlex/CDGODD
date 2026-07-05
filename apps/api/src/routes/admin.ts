import { Hono } from 'hono';
import type { AppContext } from '../env';
import { adminAuth } from '../security';

const admin = new Hono<AppContext>();
admin.use('*', adminAuth);

/** GET /admin/items?status=pending — moderation queue / item list. */
admin.get('/items', async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const { results } = await c.env.DB.prepare(
    `SELECT i.*, t.label
       FROM items i
       LEFT JOIN item_translations t ON t.item_id = i.id AND t.lang = 'fr'
      WHERE i.status = ?1
      ORDER BY i.created_at DESC
      LIMIT 100`,
  )
    .bind(status)
    .all();
  return c.json({ items: results });
});

/** PATCH /admin/items/:id — approve / reject. */
admin.patch('/items/:id', async (c) => {
  const itemId = Number(c.req.param('id'));
  const body = (await c.req.json().catch(() => ({}))) as { status?: string };
  if (!['approved', 'rejected', 'pending'].includes(body.status ?? '')) {
    return c.json({ error: 'bad status' }, 400);
  }
  await c.env.DB.prepare(`UPDATE items SET status = ?2 WHERE id = ?1`)
    .bind(itemId, body.status)
    .run();
  return c.json({ ok: true });
});

/** GET /admin/stats — vote totals overview. */
admin.get('/stats', async (c) => {
  const totals = await c.env.DB.prepare(
    `SELECT COUNT(*) AS items,
            SUM(votes_left) AS votesLeft,
            SUM(votes_right) AS votesRight
       FROM items WHERE status = 'approved'`,
  ).first();
  return c.json({ totals });
});

export default admin;
