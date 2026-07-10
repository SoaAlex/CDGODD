import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { ADMIN_HEADERS, api, SESSION_A, vote } from './helpers';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function createForm(fields: Record<string, string | string[] | File>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) for (const v of value) form.append(key, v);
    else form.append(key, value);
  }
  return form;
}

async function createItem(
  fields: Record<string, string | string[] | File>,
): Promise<Response> {
  return api('/admin/items', {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: createForm(fields),
  });
}

describe('GET /admin/items', () => {
  it('lists items by status with labels and category keys', async () => {
    const res = await api('/admin/items?status=approved', {
      headers: ADMIN_HEADERS,
    });
    const body = (await res.json()) as {
      items: Array<{ id: number; label: string; category_keys: string | null }>;
    };
    expect(body.items).toHaveLength(6);
    const quinoa = body.items.find((i) => i.id === 1)!;
    expect(quinoa.label).toBe('Le quinoa');
    expect(quinoa.category_keys).toBe('food');
  });
});

describe('GET /admin/items/counts', () => {
  it('returns a count per status, reflecting patches', async () => {
    const res = await api('/admin/items/counts', { headers: ADMIN_HEADERS });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      counts: { pending: 0, approved: 6, rejected: 0 },
    });

    // Move one item out of the approved queue and re-count.
    await api('/admin/items/1', {
      method: 'PATCH',
      headers: { ...ADMIN_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    const after = await api('/admin/items/counts', { headers: ADMIN_HEADERS });
    expect(await after.json()).toEqual({
      counts: { pending: 0, approved: 5, rejected: 1 },
    });
  });
});

describe('POST /admin/items (multipart)', () => {
  it('creates an approved item with image in R2 and flags', async () => {
    const res = await createItem({
      label: 'Le kombucha',
      categoryKeys: ['food'],
      not_mobile: '1',
      image: new File([PNG_BYTES], 'k.png', { type: 'image/png' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      itemId: number;
      imageKey: string;
    };
    expect(body.ok).toBe(true);
    expect(body.imageKey).toMatch(/^items\/[0-9a-f-]{36}\.png$/);

    const item = await env.DB.prepare(
      `SELECT status, not_mobile, nsfw, image_key FROM items WHERE id = ?1`,
    )
      .bind(body.itemId)
      .first<{ status: string; not_mobile: number; nsfw: number; image_key: string }>();
    expect(item).toEqual({
      status: 'approved',
      not_mobile: 1,
      nsfw: 0,
      image_key: body.imageKey,
    });

    const object = await env.IMAGES.get(body.imageKey);
    expect(object).not.toBeNull();
    expect(object!.httpMetadata?.contentType).toBe('image/png');

    // The deck now serves the image behind CDN_BASE.
    const deck = await api('/deck');
    const { cards } = (await deck.json()) as {
      cards: Array<{ id: number; imageUrl: string | null }>;
    };
    expect(cards.find((c) => c.id === body.itemId)!.imageUrl).toBe(
      `https://cdn.test/${body.imageKey}`,
    );
  });

  it('records an uploaded image as ai-generated when flagged', async () => {
    const res = await createItem({
      label: 'Le deepfake',
      image: new File([PNG_BYTES], 'd.png', { type: 'image/png' }),
      ai_generated: '1',
    });
    const body = (await res.json()) as { itemId: number };
    const item = await env.DB.prepare(
      `SELECT image_license FROM items WHERE id = ?1`,
    )
      .bind(body.itemId)
      .first<{ image_license: string | null }>();
    expect(item!.image_license).toBe('ai-generated');
  });

  it('leaves image_license null without the ai_generated flag', async () => {
    const res = await createItem({
      label: 'Le velo',
      image: new File([PNG_BYTES], 'v.png', { type: 'image/png' }),
    });
    const body = (await res.json()) as { itemId: number };
    const item = await env.DB.prepare(
      `SELECT image_license FROM items WHERE id = ?1`,
    )
      .bind(body.itemId)
      .first<{ image_license: string | null }>();
    expect(item!.image_license).toBeNull();
  });

  it('stores extra translations', async () => {
    const res = await createItem({
      label: 'Le café',
      translations: JSON.stringify({ en: 'Coffee' }),
    });
    const body = (await res.json()) as { itemId: number };
    const rows = await api(`/admin/items/${body.itemId}/translations`, {
      headers: ADMIN_HEADERS,
    });
    expect(await rows.json()).toEqual({
      translations: [
        { lang: 'en', label: 'Coffee' },
        { lang: 'fr', label: 'Le café' },
      ],
    });
  });

  it('400s on invalid input', async () => {
    expect((await createItem({})).status).toBe(400); // no label
    expect(
      (
        await createItem({
          label: 'x',
          image: new File([PNG_BYTES], 'x.txt', { type: 'text/plain' }),
        })
      ).status,
    ).toBe(400); // non-image
    expect(
      (await createItem({ label: 'x', categoryKeys: ['nope'] })).status,
    ).toBe(400); // unknown category
    expect(
      (await createItem({ label: 'x', translations: '{not json' })).status,
    ).toBe(400);
  });
});

describe('PATCH /admin/items/:id', () => {
  function patch(id: number, body: unknown): Promise<Response> {
    return api(`/admin/items/${id}`, {
      method: 'PATCH',
      headers: { ...ADMIN_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('updates status, label, votes and flags', async () => {
    const res = await patch(1, {
      status: 'rejected',
      label: 'Le quinoa bio',
      votes_left: 10,
      votes_right: 3,
      nsfw: true,
    });
    expect(res.status).toBe(200);

    const item = await env.DB.prepare(
      `SELECT status, votes_left, votes_right, nsfw FROM items WHERE id = 1`,
    ).first();
    expect(item).toEqual({
      status: 'rejected',
      votes_left: 10,
      votes_right: 3,
      nsfw: 1,
    });
    const label = await env.DB.prepare(
      `SELECT label FROM item_translations WHERE item_id = 1 AND lang = 'fr'`,
    ).first<{ label: string }>();
    expect(label!.label).toBe('Le quinoa bio');
  });

  it('replaces and clears the category set', async () => {
    await patch(1, { categoryKeys: ['culture', 'daily-life'] });
    let { results } = await env.DB.prepare(
      `SELECT c.key FROM item_categories ic
        JOIN categories c ON c.id = ic.category_id WHERE ic.item_id = 1`,
    ).all<{ key: string }>();
    expect(results.map((r) => r.key).sort()).toEqual(['culture', 'daily-life']);

    await patch(1, { categoryKeys: [] });
    ({ results } = await env.DB.prepare(
      `SELECT category_id FROM item_categories WHERE item_id = 1`,
    ).all());
    expect(results).toEqual([]);
  });

  it('400s on invalid partial values', async () => {
    expect((await patch(1, { status: 'nope' })).status).toBe(400);
    expect((await patch(1, { votes_left: -1 })).status).toBe(400);
    expect((await patch(1, { not_mobile: 'yes' })).status).toBe(400);
    expect((await patch(1, { categoryKeys: ['unknown'] })).status).toBe(400);
    expect((await patch(1, { label: '   ' })).status).toBe(400);
  });
});

describe('DELETE /admin/items/:id', () => {
  it('cascades: votes, reports, categories, translations, item, R2 image', async () => {
    const created = await createItem({
      label: 'Éphémère',
      image: new File([PNG_BYTES], 'e.png', { type: 'image/png' }),
    });
    const { itemId, imageKey } = (await created.json()) as {
      itemId: number;
      imageKey: string;
    };
    await vote(itemId, 'left', SESSION_A);
    await env.DB.prepare(
      `INSERT INTO reports (item_id, created_at) VALUES (?1, 0)`,
    )
      .bind(itemId)
      .run();

    const res = await api(`/admin/items/${itemId}`, {
      method: 'DELETE',
      headers: ADMIN_HEADERS,
    });
    expect(res.status).toBe(200);

    for (const table of ['votes', 'reports', 'item_translations', 'items']) {
      const col = table === 'items' ? 'id' : 'item_id';
      const row = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?1`,
      )
        .bind(itemId)
        .first<{ n: number }>();
      expect(row!.n).toBe(0);
    }
    expect(await env.IMAGES.get(imageKey)).toBeNull();
  });

  it('404s on an unknown item', async () => {
    const res = await api('/admin/items/999', {
      method: 'DELETE',
      headers: ADMIN_HEADERS,
    });
    expect(res.status).toBe(404);
  });
});
