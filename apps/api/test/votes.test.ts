import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, jsonPost, SESSION_A, SESSION_B, vote } from './helpers';

describe('POST /items/:id/vote', () => {
  it('records a vote and returns the tally', async () => {
    const res = await vote(1, 'left', SESSION_A);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      tally: { itemId: 1, votesLeft: 1, votesRight: 0 },
    });
  });

  it('is idempotent per session — a re-vote (even opposite) is a no-op', async () => {
    await vote(1, 'left', SESSION_A);
    const again = await vote(1, 'right', SESSION_A);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({
      tally: { itemId: 1, votesLeft: 1, votesRight: 0 },
    });
  });

  it('counts distinct sessions separately', async () => {
    await vote(1, 'left', SESSION_A);
    const res = await vote(1, 'right', SESSION_B);
    expect(await res.json()).toEqual({
      tally: { itemId: 1, votesLeft: 1, votesRight: 1 },
    });
  });

  it('caps votes per item per ip_hash — session cycling is a no-op', async () => {
    // All test requests share one ip_hash (no cf-connecting-ip header).
    for (let i = 1; i <= 5; i++) {
      await vote(1, 'left', `${i}${SESSION_A.slice(1)}`);
    }
    const capped = await vote(1, 'left', `9${SESSION_A.slice(1)}`);
    expect(capped.status).toBe(200);
    expect(await capped.json()).toEqual({
      tally: { itemId: 1, votesLeft: 5, votesRight: 0 },
    });
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM votes WHERE item_id = 1`,
    ).first<{ n: number }>();
    expect(count!.n).toBe(5);
  });

  it('404s on an unknown item', async () => {
    const res = await vote(999, 'left', SESSION_A);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'item not found' });
  });

  it('400s on bad item ids', async () => {
    for (const bad of ['abc', '0', '-1', '1.5']) {
      const res = await vote(bad as unknown as number, 'left', SESSION_A);
      expect(res.status).toBe(400);
    }
  });

  it('400s on a bad body', async () => {
    for (const body of [
      {},
      { side: 'left' },
      { side: 'up', turnstileToken: 'dev' },
      { side: 'left', turnstileToken: '' },
    ]) {
      const res = await api(
        '/items/1/vote',
        jsonPost(body, { 'x-session-id': SESSION_A }),
      );
      expect(res.status).toBe(400);
    }
  });

  it('never counts votes for a non-approved item', async () => {
    const row = await env.DB.prepare(
      `INSERT INTO items (status, created_at) VALUES ('pending', 0) RETURNING id`,
    ).first<{ id: number }>();
    const res = await vote(row!.id, 'left', SESSION_A);
    expect(res.status).toBe(404);
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM votes WHERE item_id = ?1`,
    )
      .bind(row!.id)
      .first<{ n: number }>();
    expect(count!.n).toBe(0);
  });
});

describe('turnstile verification (secret set)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    env.TURNSTILE_SECRET = undefined;
  });

  it('403s when siteverify says no', async () => {
    env.TURNSTILE_SECRET = 'test-secret';
    const fetchSpy = vi.fn(async () => Response.json({ success: false }));
    vi.stubGlobal('fetch', fetchSpy);

    const res = await vote(1, 'left', SESSION_A);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'turnstile failed' });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.anything(),
    );
  });

  it('passes when siteverify says yes', async () => {
    env.TURNSTILE_SECRET = 'test-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ success: true })),
    );

    const res = await vote(1, 'left', SESSION_A);
    expect(res.status).toBe(200);
  });
});
