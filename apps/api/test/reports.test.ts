import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { api, jsonPost, SESSION_A } from './helpers';

function report(itemId: number | string, body: Record<string, unknown> = {}) {
  return api(
    `/items/${itemId}/report`,
    jsonPost({ turnstileToken: 'dev', ...body }, { 'x-session-id': SESSION_A }),
  );
}

describe('POST /items/:id/report', () => {
  it('increments report_count and stores the report row', async () => {
    const res = await report(1, { reason: 'trop clivant' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const item = await env.DB.prepare(
      `SELECT report_count, status FROM items WHERE id = 1`,
    ).first<{ report_count: number; status: string }>();
    expect(item).toEqual({ report_count: 1, status: 'approved' });

    const row = await env.DB.prepare(
      `SELECT reason, reporter_session FROM reports WHERE item_id = 1`,
    ).first<{ reason: string; reporter_session: string }>();
    expect(row).toEqual({ reason: 'trop clivant', reporter_session: SESSION_A });
  });

  it('reason is optional (stored as null)', async () => {
    await report(1);
    const row = await env.DB.prepare(
      `SELECT reason FROM reports WHERE item_id = 1`,
    ).first<{ reason: string | null }>();
    expect(row!.reason).toBeNull();
  });

  it('auto-hides the item at the 5th report and pulls it from the deck', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await report(1)).status).toBe(200);
    }
    const item = await env.DB.prepare(
      `SELECT report_count, status FROM items WHERE id = 1`,
    ).first<{ report_count: number; status: string }>();
    expect(item).toEqual({ report_count: 5, status: 'pending' });

    const deck = await api('/deck');
    const { cards } = (await deck.json()) as { cards: Array<{ id: number }> };
    expect(cards.map((c) => c.id)).not.toContain(1);
    expect(cards).toHaveLength(5);
  });

  it('400s on bad ids and bad bodies', async () => {
    expect((await report('abc')).status).toBe(400);
    expect((await report(0)).status).toBe(400);
    const noToken = await api(
      '/items/1/report',
      jsonPost({}, { 'x-session-id': SESSION_A }),
    );
    expect(noToken.status).toBe(400);
  });
});
