import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { api, jsonPost, SESSION_A } from './helpers';

function submit(body: Record<string, unknown>, sessionId?: string) {
  return api(
    '/submissions',
    jsonPost(
      { turnstileToken: 'dev', ...body },
      sessionId ? { 'x-session-id': sessionId } : {},
    ),
  );
}

describe('POST /submissions', () => {
  it('rejects blocklisted labels without inserting anything', async () => {
    const res = await submit({ label: 'Hitler' }, SESSION_A);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'rejected' });
    const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM items`).first<{
      n: number;
    }>();
    expect(count!.n).toBe(6); // seed only
  });

  it('detects duplicates via normalized labels', async () => {
    for (const dupe of ['quinoa', 'LE QUINOA', 'le  quinoa']) {
      const res = await submit({ label: dupe }, SESSION_A);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'duplicate', itemId: 1 });
    }
  });

  it('stores a new label as a pending item owned by the session', async () => {
    const res = await submit({ label: 'Le pastis' }, SESSION_A);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; itemId: number };
    expect(body.status).toBe('pending');

    const item = await env.DB.prepare(
      `SELECT status, submitted_by FROM items WHERE id = ?1`,
    )
      .bind(body.itemId)
      .first<{ status: string; submitted_by: string }>();
    expect(item).toEqual({ status: 'pending', submitted_by: SESSION_A });

    const translation = await env.DB.prepare(
      `SELECT label FROM item_translations WHERE item_id = ?1 AND lang = 'fr'`,
    )
      .bind(body.itemId)
      .first<{ label: string }>();
    expect(translation!.label).toBe('Le pastis');
  });

  it('links known category hints and silently skips unknown ones', async () => {
    const res = await submit(
      { label: 'Le pastis', categoryKeys: ['food', 'does-not-exist'] },
      SESSION_A,
    );
    const body = (await res.json()) as { itemId: number };
    const { results } = await env.DB.prepare(
      `SELECT c.key FROM item_categories ic
        JOIN categories c ON c.id = ic.category_id WHERE ic.item_id = ?1`,
    )
      .bind(body.itemId)
      .all<{ key: string }>();
    expect(results.map((r) => r.key)).toEqual(['food']);
  });

  it('400s without a session id', async () => {
    const res = await submit({ label: 'Le pastis' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'missing session id' });
  });

  it('400s on a bad body', async () => {
    const res = await submit({ label: '' }, SESSION_A);
    expect(res.status).toBe(400);
  });
});
