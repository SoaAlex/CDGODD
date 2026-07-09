import { Hono } from 'hono';
import type { AppContext } from '../env';
import { adminAuth } from '../security';

const admin = new Hono<AppContext>();
admin.use('*', adminAuth);

const CATEGORY_KEY_RE = /^[a-z0-9-]{1,50}$/;
const LANG_RE = /^[a-z]{2}$/;

/**
 * Resolve category keys to ids, deduplicated. Returns null if any key is
 * unknown (caller answers 400).
 */
async function resolveCategoryIds(
  db: D1Database,
  keys: string[],
): Promise<number[] | null> {
  const unique = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const placeholders = unique.map((_, i) => `?${i + 1}`).join(',');
  const { results } = await db
    .prepare(`SELECT id FROM categories WHERE key IN (${placeholders})`)
    .bind(...unique)
    .all<{ id: number }>();
  if (results.length !== unique.length) return null;
  return results.map((r) => r.id);
}

/** Replace an item's category set with the given category ids. */
async function setItemCategories(
  db: D1Database,
  itemId: number,
  categoryIds: number[],
): Promise<void> {
  const statements = [
    db.prepare(`DELETE FROM item_categories WHERE item_id = ?1`).bind(itemId),
    ...categoryIds.map((id) =>
      db
        .prepare(
          `INSERT INTO item_categories (item_id, category_id) VALUES (?1, ?2)`,
        )
        .bind(itemId, id),
    ),
  ];
  await db.batch(statements);
}

/** GET /admin/items?status=pending — moderation queue / item list. */
admin.get('/items', async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const { results } = await c.env.DB.prepare(
    `SELECT i.*, t.label,
            (SELECT GROUP_CONCAT(c.key)
               FROM item_categories ic
               JOIN categories c ON c.id = ic.category_id
              WHERE ic.item_id = i.id) AS category_keys
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

/**
 * PATCH /admin/items/:id — partial edit.
 * Any subset of: status, label (fr), votes_left, votes_right, categoryKeys
 * (replaces the whole category set; [] clears it). Image is replaced via
 * the separate /admin/items/:id/image endpoint.
 */
admin.patch('/items/:id', async (c) => {
  const itemId = Number(c.req.param('id'));
  const body = (await c.req.json().catch(() => ({}))) as {
    status?: string;
    label?: string;
    votes_left?: number;
    votes_right?: number;
    categoryKeys?: string[];
  };

  const sets: string[] = [];
  const binds: unknown[] = [];

  if (body.status !== undefined) {
    if (!['approved', 'rejected', 'pending'].includes(body.status)) {
      return c.json({ error: 'bad status' }, 400);
    }
    sets.push('status = ?');
    binds.push(body.status);
  }

  for (const key of ['votes_left', 'votes_right'] as const) {
    const value = body[key];
    if (value !== undefined) {
      if (!Number.isInteger(value) || value < 0) {
        return c.json({ error: `bad ${key}` }, 400);
      }
      sets.push(`${key} = ?`);
      binds.push(value);
    }
  }

  if (body.categoryKeys !== undefined) {
    if (!Array.isArray(body.categoryKeys)) {
      return c.json({ error: 'categoryKeys must be an array' }, 400);
    }
    const categoryIds = await resolveCategoryIds(c.env.DB, body.categoryKeys);
    if (categoryIds === null) {
      return c.json({ error: 'unknown category' }, 400);
    }
    await setItemCategories(c.env.DB, itemId, categoryIds);
  }

  if (sets.length > 0) {
    binds.push(itemId);
    await c.env.DB.prepare(
      `UPDATE items SET ${sets.join(', ')} WHERE id = ?`,
    )
      .bind(...binds)
      .run();
  }

  if (body.label !== undefined) {
    const label = body.label.trim();
    if (!label) return c.json({ error: 'label empty' }, 400);
    await c.env.DB.prepare(
      `INSERT INTO item_translations (item_id, lang, label)
       VALUES (?1, 'fr', ?2)
       ON CONFLICT(item_id, lang) DO UPDATE SET label = excluded.label`,
    )
      .bind(itemId, label)
      .run();
  }

  return c.json({ ok: true });
});

/**
 * POST /admin/items — create an item with its image (multipart form).
 * Fields: label (required), lang (default fr), categoryKeys (repeatable),
 * image (file). Admin-created items go live immediately (status=approved).
 */
admin.post('/items', async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: 'multipart form expected' }, 400);

  const label = String(form.get('label') ?? '').trim();
  const lang = String(form.get('lang') ?? 'fr');
  const categoryKeys = form.getAll('categoryKeys').map(String);
  const image = form.get('image');
  if (!label) return c.json({ error: 'label required' }, 400);

  // Optional extra labels: JSON object { "en": "Coffee", ... }.
  const translationsRaw = form.get('translations');
  let extraTranslations: [string, string][] = [];
  if (typeof translationsRaw === 'string' && translationsRaw !== '') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(translationsRaw);
    } catch {
      return c.json({ error: 'bad translations JSON' }, 400);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return c.json({ error: 'bad translations JSON' }, 400);
    }
    extraTranslations = Object.entries(parsed as Record<string, unknown>)
      .map(([l, v]) => [l, String(v ?? '').trim()] as [string, string])
      .filter(([l]) => l !== lang);
    for (const [l, v] of extraTranslations) {
      if (!LANG_RE.test(l) || !v || v.length > 80) {
        return c.json({ error: `bad translation for lang "${l}"` }, 400);
      }
    }
  }

  const categoryIds = await resolveCategoryIds(c.env.DB, categoryKeys);
  if (categoryIds === null) return c.json({ error: 'unknown category' }, 400);

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

  const item = await c.env.DB.prepare(
    `INSERT INTO items (image_key, status, created_at)
     VALUES (?1, 'approved', ?2) RETURNING id`,
  )
    .bind(imageKey, Date.now())
    .first<{ id: number }>();

  await c.env.DB.prepare(
    `INSERT INTO item_translations (item_id, lang, label) VALUES (?1, ?2, ?3)`,
  )
    .bind(item!.id, lang, label)
    .run();
  for (const [l, v] of extraTranslations) {
    await c.env.DB.prepare(
      `INSERT INTO item_translations (item_id, lang, label) VALUES (?1, ?2, ?3)`,
    )
      .bind(item!.id, l, v)
      .run();
  }

  if (categoryIds.length > 0) {
    await setItemCategories(c.env.DB, item!.id, categoryIds);
  }

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

/** GET /admin/items/:id/translations — all labels of one item, by lang. */
admin.get('/items/:id/translations', async (c) => {
  const itemId = Number(c.req.param('id'));
  const { results } = await c.env.DB.prepare(
    `SELECT lang, label FROM item_translations
      WHERE item_id = ?1 ORDER BY lang`,
  )
    .bind(itemId)
    .all<{ lang: string; label: string }>();
  return c.json({ translations: results });
});

/** PUT /admin/items/:id/translations/:lang — add or update one label. */
admin.put('/items/:id/translations/:lang', async (c) => {
  const itemId = Number(c.req.param('id'));
  const lang = c.req.param('lang');
  if (!LANG_RE.test(lang)) return c.json({ error: 'bad lang' }, 400);

  const body = (await c.req.json().catch(() => ({}))) as { label?: string };
  const label = body.label?.trim() ?? '';
  if (!label || label.length > 80) return c.json({ error: 'bad label' }, 400);

  const item = await c.env.DB.prepare(`SELECT id FROM items WHERE id = ?1`)
    .bind(itemId)
    .first();
  if (!item) return c.json({ error: 'unknown item' }, 404);

  await c.env.DB.prepare(
    `INSERT INTO item_translations (item_id, lang, label)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(item_id, lang) DO UPDATE SET label = excluded.label`,
  )
    .bind(itemId, lang, label)
    .run();
  return c.json({ ok: true });
});

/** DELETE /admin/items/:id/translations/:lang — remove one label. */
admin.delete('/items/:id/translations/:lang', async (c) => {
  const itemId = Number(c.req.param('id'));
  const lang = c.req.param('lang');
  await c.env.DB.prepare(
    `DELETE FROM item_translations WHERE item_id = ?1 AND lang = ?2`,
  )
    .bind(itemId, lang)
    .run();
  return c.json({ ok: true });
});

/** GET /admin/categories — all categories with every translation. */
admin.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.key, ct.lang, ct.name
       FROM categories c
       LEFT JOIN category_translations ct ON ct.category_id = c.id
      ORDER BY c.key, ct.lang`,
  ).all<{ id: number; key: string; lang: string | null; name: string | null }>();

  const byKey = new Map<
    string,
    { id: number; key: string; translations: Record<string, string> }
  >();
  for (const row of results) {
    let cat = byKey.get(row.key);
    if (!cat) {
      cat = { id: row.id, key: row.key, translations: {} };
      byKey.set(row.key, cat);
    }
    if (row.lang && row.name) cat.translations[row.lang] = row.name;
  }
  return c.json({ categories: [...byKey.values()] });
});

/**
 * POST /admin/categories — create a category.
 * Body: { key, translations?: { fr: "Nourriture", ... } }.
 */
admin.post('/categories', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    key?: string;
    translations?: Record<string, string>;
  };
  const key = body.key?.trim().toLowerCase() ?? '';
  if (!CATEGORY_KEY_RE.test(key)) {
    return c.json({ error: 'bad key (a-z, 0-9, dashes, max 50)' }, 400);
  }
  const translations = Object.entries(body.translations ?? {}).map(
    ([lang, name]) => [lang, name?.trim() ?? ''] as const,
  );
  for (const [lang, name] of translations) {
    if (!LANG_RE.test(lang) || !name || name.length > 80) {
      return c.json({ error: `bad translation for lang "${lang}"` }, 400);
    }
  }

  const existing = await c.env.DB.prepare(
    `SELECT id FROM categories WHERE key = ?1`,
  )
    .bind(key)
    .first();
  if (existing) return c.json({ error: 'category already exists' }, 409);

  const cat = await c.env.DB.prepare(
    `INSERT INTO categories (key) VALUES (?1) RETURNING id`,
  )
    .bind(key)
    .first<{ id: number }>();
  for (const [lang, name] of translations) {
    await c.env.DB.prepare(
      `INSERT INTO category_translations (category_id, lang, name)
       VALUES (?1, ?2, ?3)`,
    )
      .bind(cat!.id, lang, name)
      .run();
  }
  return c.json({ ok: true, id: cat!.id, key });
});

/** PUT /admin/categories/:key/translations/:lang — add or update one name. */
admin.put('/categories/:key/translations/:lang', async (c) => {
  const key = c.req.param('key');
  const lang = c.req.param('lang');
  if (!LANG_RE.test(lang)) return c.json({ error: 'bad lang' }, 400);

  const body = (await c.req.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim() ?? '';
  if (!name || name.length > 80) return c.json({ error: 'bad name' }, 400);

  const cat = await c.env.DB.prepare(`SELECT id FROM categories WHERE key = ?1`)
    .bind(key)
    .first<{ id: number }>();
  if (!cat) return c.json({ error: 'unknown category' }, 404);

  await c.env.DB.prepare(
    `INSERT INTO category_translations (category_id, lang, name)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(category_id, lang) DO UPDATE SET name = excluded.name`,
  )
    .bind(cat.id, lang, name)
    .run();
  return c.json({ ok: true });
});

/** DELETE /admin/categories/:key/translations/:lang — remove one name. */
admin.delete('/categories/:key/translations/:lang', async (c) => {
  const key = c.req.param('key');
  const lang = c.req.param('lang');
  const cat = await c.env.DB.prepare(`SELECT id FROM categories WHERE key = ?1`)
    .bind(key)
    .first<{ id: number }>();
  if (!cat) return c.json({ error: 'unknown category' }, 404);

  await c.env.DB.prepare(
    `DELETE FROM category_translations WHERE category_id = ?1 AND lang = ?2`,
  )
    .bind(cat.id, lang)
    .run();
  return c.json({ ok: true });
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
