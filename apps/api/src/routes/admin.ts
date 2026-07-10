import { Hono } from 'hono';
import type { AppContext } from '../env';
import {
  isAllowedImageHost,
  searchPixabay,
  searchWikimedia,
  SOURCE_FETCH_UA,
  type ImageCandidate,
} from '../image-sources';
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

/** GET /admin/items/counts — item count per status, for the moderation tabs. */
admin.get('/items/counts', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT status, COUNT(*) AS n FROM items GROUP BY status`,
  ).all<{ status: string; n: number }>();
  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const r of results) {
    if (r.status in counts) counts[r.status as keyof typeof counts] = r.n;
  }
  return c.json({ counts });
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
    not_mobile?: boolean;
    nsfw?: boolean;
    categoryKeys?: string[];
  };

  const sets: string[] = [];
  const binds: unknown[] = [];

  for (const key of ['not_mobile', 'nsfw'] as const) {
    const value = body[key];
    if (value !== undefined) {
      if (typeof value !== 'boolean') {
        return c.json({ error: `bad ${key}` }, 400);
      }
      sets.push(`${key} = ?`);
      binds.push(value ? 1 : 0);
    }
  }

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
 * DELETE /admin/items/:id — permanently remove an item: its votes, reports,
 * category links, translations, the row itself, then its R2 image.
 */
admin.delete('/items/:id', async (c) => {
  const itemId = Number(c.req.param('id'));
  const item = await c.env.DB.prepare(
    `SELECT image_key FROM items WHERE id = ?1`,
  )
    .bind(itemId)
    .first<{ image_key: string | null }>();
  if (!item) return c.json({ error: 'item not found' }, 404);

  // Children first: D1 enforces the REFERENCES constraints.
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM votes WHERE item_id = ?1`).bind(itemId),
    c.env.DB.prepare(`DELETE FROM reports WHERE item_id = ?1`).bind(itemId),
    c.env.DB.prepare(`DELETE FROM item_categories WHERE item_id = ?1`).bind(
      itemId,
    ),
    c.env.DB.prepare(`DELETE FROM item_translations WHERE item_id = ?1`).bind(
      itemId,
    ),
    c.env.DB.prepare(`DELETE FROM items WHERE id = ?1`).bind(itemId),
  ]);

  if (item.image_key) await c.env.IMAGES.delete(item.image_key);
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
  const notMobile = form.get('not_mobile') === '1' ? 1 : 0;
  const nsfw = form.get('nsfw') === '1' ? 1 : 0;
  // Admin marks their own upload as AI-made → credit it like generated images.
  const aiGenerated = form.get('ai_generated') === '1';
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

  const imageLicense = imageKey && aiGenerated ? 'ai-generated' : null;
  const item = await c.env.DB.prepare(
    `INSERT INTO items (image_key, image_license, status, not_mobile, nsfw, created_at)
     VALUES (?1, ?2, 'approved', ?3, ?4, ?5) RETURNING id`,
  )
    .bind(imageKey, imageLicense, notMobile, nsfw, Date.now())
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
  // Manual uploads carry no attribution — clear any stale credit, except an
  // explicit "this upload is AI-made" flag which we record as ai-generated.
  const imageLicense = form?.get('ai_generated') === '1' ? 'ai-generated' : null;
  await c.env.DB.prepare(
    `UPDATE items SET image_key = ?2, image_source = NULL, image_author = NULL,
            image_license = ?3, image_source_url = NULL WHERE id = ?1`,
  )
    .bind(itemId, imageKey, imageLicense)
    .run();
  return c.json({ ok: true, imageKey });
});

/**
 * GET /admin/image-candidates?q=term — free-license image candidates from
 * Wikimedia Commons + Pixabay (skipped without PIXABAY_KEY), interleaved.
 * Item-agnostic so the admin can refine the search query.
 */
admin.get('/image-candidates', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  if (!q || q.length > 100) return c.json({ error: 'bad q' }, 400);

  const [wikimedia, pixabay] = await Promise.all([
    searchWikimedia(q),
    c.env.PIXABAY_KEY ? searchPixabay(q, c.env.PIXABAY_KEY) : [],
  ]);

  const candidates: ImageCandidate[] = [];
  const max = Math.max(wikimedia.length, pixabay.length);
  for (let i = 0; i < max && candidates.length < 24; i++) {
    if (i < wikimedia.length) candidates.push(wikimedia[i]!);
    if (i < pixabay.length && candidates.length < 24) {
      candidates.push(pixabay[i]!);
    }
  }
  return c.json({ candidates });
});

/** Copy the R2 put pattern used by the upload endpoints. */
async function putItemImage(
  images: R2Bucket,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const imageKey = `items/${crypto.randomUUID()}.${ext}`;
  await images.put(imageKey, bytes, {
    httpMetadata: {
      contentType,
      // Keys are content-unique UUIDs, so the images domain can cache forever.
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });
  return imageKey;
}

const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * POST /admin/items/:id/image-from-source — copy a picked candidate to R2
 * and store its attribution. Body: { fullUrl, source, author, license,
 * sourcePageUrl } echoed from /admin/image-candidates.
 */
admin.post('/items/:id/image-from-source', async (c) => {
  const itemId = Number(c.req.param('id'));
  const body = (await c.req.json().catch(() => ({}))) as {
    fullUrl?: string;
    source?: string;
    author?: string | null;
    license?: string;
    sourcePageUrl?: string;
  };

  const item = await c.env.DB.prepare(`SELECT id FROM items WHERE id = ?1`)
    .bind(itemId)
    .first();
  if (!item) return c.json({ error: 'item not found' }, 404);

  const source = body.source;
  if (source !== 'wikimedia' && source !== 'pixabay') {
    return c.json({ error: 'bad source' }, 400);
  }
  const license = (body.license ?? '').trim();
  const fullUrl = body.fullUrl ?? '';
  const sourcePageUrl = body.sourcePageUrl ?? '';
  const author = body.author?.trim() || null;
  if (!license || !fullUrl || !sourcePageUrl) {
    return c.json({ error: 'fullUrl, license, sourcePageUrl required' }, 400);
  }
  for (const v of [fullUrl, license, sourcePageUrl, author ?? '']) {
    if (v.length > 500) return c.json({ error: 'field too long' }, 400);
  }

  let hostname: string;
  try {
    hostname = new URL(fullUrl).hostname;
  } catch {
    return c.json({ error: 'bad fullUrl' }, 400);
  }
  if (!isAllowedImageHost(source, hostname)) {
    return c.json({ error: 'host not allowed' }, 400);
  }

  const res = await fetch(fullUrl, {
    headers: { 'User-Agent': SOURCE_FETCH_UA },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  const contentType = res?.headers.get('content-type') ?? '';
  if (!res?.ok || !contentType.startsWith('image/')) {
    return c.json({ error: 'source image fetch failed' }, 502);
  }
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_SOURCE_IMAGE_BYTES) {
    return c.json({ error: 'image too large' }, 400);
  }

  const imageKey = await putItemImage(c.env.IMAGES, bytes, contentType);
  await c.env.DB.prepare(
    `UPDATE items SET image_key = ?2, image_source = ?3, image_author = ?4,
            image_license = ?5, image_source_url = ?6 WHERE id = ?1`,
  )
    .bind(itemId, imageKey, source, author, license, sourcePageUrl)
    .run();
  return c.json({ ok: true, imageKey });
});

/**
 * POST /admin/items/:id/ai-image — generate an image with Workers AI
 * (flux-1-schnell) from the item's fr label, or an explicit { prompt }.
 */
admin.post('/items/:id/ai-image', async (c) => {
  const itemId = Number(c.req.param('id'));
  const body = (await c.req.json().catch(() => ({}))) as { prompt?: string };

  const exists = await c.env.DB.prepare(`SELECT id FROM items WHERE id = ?1`)
    .bind(itemId)
    .first();
  if (!exists) return c.json({ error: 'item not found' }, 404);

  let prompt = body.prompt?.trim() ?? '';
  if (prompt.length > 2048) return c.json({ error: 'prompt too long' }, 400);
  if (!prompt) {
    const row = await c.env.DB.prepare(
      `SELECT label FROM item_translations WHERE item_id = ?1 AND lang = 'fr'`,
    )
      .bind(itemId)
      .first<{ label: string }>();
    if (!row) return c.json({ error: 'item or fr label not found' }, 404);
    // Flux prompts work best in English; the subject stays verbatim.
    // Full-frame close-up composition: poster-like prompts ("centered
    // subject, clean background") make flux render the label as a title.
    prompt =
      `Detailed close-up photograph of ${row.label}, the subject fills ` +
      'the entire frame edge to edge, natural lighting, shallow depth of ' +
      'field, vibrant colors, professional stock photography';
  }

  const out = (await c.env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
    prompt,
    steps: 8,
  })) as { image?: string };
  if (!out.image) return c.json({ error: 'generation failed' }, 502);
  const bytes = Uint8Array.from(atob(out.image), (ch) => ch.codePointAt(0)!);

  const imageKey = await putItemImage(
    c.env.IMAGES,
    bytes.buffer as ArrayBuffer,
    'image/jpeg',
  );
  await c.env.DB.prepare(
    `UPDATE items SET image_key = ?2, image_source = 'ai', image_author = NULL,
            image_license = 'ai-generated', image_source_url = NULL
      WHERE id = ?1`,
  )
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
