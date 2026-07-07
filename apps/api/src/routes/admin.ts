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

/**
 * POST /admin/items — create an item with its image (multipart form).
 * Fields: label (required), lang (default fr), categoryKey, image (file).
 * Admin-created items go live immediately (status=approved).
 */
admin.post('/items', async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: 'multipart form expected' }, 400);

  const label = String(form.get('label') ?? '').trim();
  const lang = String(form.get('lang') ?? 'fr');
  const categoryKey = String(form.get('categoryKey') ?? '').trim();
  const image = form.get('image');
  if (!label) return c.json({ error: 'label required' }, 400);

  let imageKey: string | null = null;
  if (image instanceof File && image.size > 0) {
    if (!image.type.startsWith('image/')) {
      return c.json({ error: 'image files only' }, 400);
    }
    const ext = image.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
    imageKey = `items/${crypto.randomUUID()}.${ext}`;
    await c.env.IMAGES.put(imageKey, image.stream(), {
      httpMetadata: {
        contentType: image.type,
        // Keys are content-unique UUIDs → the images domain caches forever.
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  }

  const category = categoryKey
    ? await c.env.DB.prepare(`SELECT id FROM categories WHERE key = ?1`)
        .bind(categoryKey)
        .first<{ id: number }>()
    : null;

  const item = await c.env.DB.prepare(
    `INSERT INTO items (category_id, image_key, status, created_at)
     VALUES (?1, ?2, 'approved', ?3) RETURNING id`,
  )
    .bind(category?.id ?? null, imageKey, Date.now())
    .first<{ id: number }>();

  await c.env.DB.prepare(
    `INSERT INTO item_translations (item_id, lang, label) VALUES (?1, ?2, ?3)`,
  )
    .bind(item!.id, lang, label)
    .run();

  return c.json({ ok: true, itemId: item!.id, imageKey });
});

/** PATCH /admin/items/:id/image — attach/replace an item's image. */
admin.patch('/items/:id/image', async (c) => {
  const itemId = Number(c.req.param('id'));
  const form = await c.req.formData().catch(() => null);
  const image = form?.get('image');
  if (!(image instanceof File) || image.size === 0) {
    return c.json({ error: 'image file required' }, 400);
  }
  if (!image.type.startsWith('image/')) {
    return c.json({ error: 'image files only' }, 400);
  }
  const ext = image.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const imageKey = `items/${crypto.randomUUID()}.${ext}`;
  await c.env.IMAGES.put(imageKey, image.stream(), {
    httpMetadata: {
      contentType: image.type,
      // Keys are content-unique UUIDs, so the images domain can cache forever.
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });
  await c.env.DB.prepare(`UPDATE items SET image_key = ?2 WHERE id = ?1`)
    .bind(itemId, imageKey)
    .run();
  return c.json({ ok: true, imageKey });
});

/** GET /admin/reports — recent reports with item labels, most reported first. */
admin.get('/reports', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.item_id, r.reason, r.created_at,
            t.label, i.status, i.report_count
       FROM reports r
       JOIN items i ON i.id = r.item_id
       LEFT JOIN item_translations t ON t.item_id = i.id AND t.lang = 'fr'
      ORDER BY i.report_count DESC, r.created_at DESC
      LIMIT 100`,
  ).all();
  return c.json({ reports: results });
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
