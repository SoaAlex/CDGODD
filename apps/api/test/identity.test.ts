import {
  createExecutionContext,
  createScheduledController,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { IP_HASH_WINDOW_MS } from '../src/security';
import { api, SESSION_A, SESSION_B, vote } from './helpers';

describe('identity middleware', () => {
  it('accepts a valid session UUID', async () => {
    const res = await vote(1, 'left', SESSION_A);
    expect(res.status).toBe(200);
  });

  it('treats a malformed session id as null (vote refused)', async () => {
    for (const bad of ['abc', '']) {
      const res = await api('/items/1/vote', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-session-id': bad,
        },
        body: JSON.stringify({ side: 'left', turnstileToken: 'dev' }),
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'missing session id' });
    }
  });

  it('refuses a vote without any session header', async () => {
    const res = await api('/items/1/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ side: 'left', turnstileToken: 'dev' }),
    });
    expect(res.status).toBe(400);
  });

  it('stores a deterministic salted ip hash, never the raw IP', async () => {
    // workerd strips cf-connecting-ip from test-constructed requests, so the
    // middleware always sees its '0.0.0.0' fallback here. That still proves
    // the pipeline: sha256('{salt}:{epoch}:{ip}') with the 'dev-salt'
    // fallback and the 30-day salt epoch, truncated to 32 hex chars,
    // identical across sessions — no raw IP.
    await vote(1, 'left', SESSION_A);
    await vote(1, 'right', SESSION_B);

    const { results } = await env.DB.prepare(
      `SELECT session_id, ip_hash FROM votes ORDER BY id`,
    ).all<{ session_id: string; ip_hash: string }>();
    expect(results).toHaveLength(2);

    const epoch = Math.floor(Date.now() / IP_HASH_WINDOW_MS);
    const expected = await sha256Hex32(`dev-salt:${epoch}:0.0.0.0`);
    expect(results[0]!.ip_hash).toBe(expected);
    expect(results[1]!.ip_hash).toBe(expected);
    expect(results[0]!.ip_hash).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('scheduled ip_hash purge', () => {
  it('nulls ip_hash on votes older than the window, keeps recent ones', async () => {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO votes (item_id, side, session_id, ip_hash, created_at)
         VALUES (1, 'left', ?1, 'old-hash', ?2)`,
      ).bind(SESSION_A, now - IP_HASH_WINDOW_MS - 1000),
      env.DB.prepare(
        `INSERT INTO votes (item_id, side, session_id, ip_hash, created_at)
         VALUES (1, 'left', ?1, 'new-hash', ?2)`,
      ).bind(SESSION_B, now),
    ]);

    const controller = createScheduledController({
      scheduledTime: new Date(now),
      cron: '0 4 * * *',
    });
    const ctx = createExecutionContext();
    await worker.scheduled(controller, env, ctx);
    await waitOnExecutionContext(ctx);

    const { results } = await env.DB.prepare(
      `SELECT session_id, ip_hash FROM votes ORDER BY id`,
    ).all<{ session_id: string; ip_hash: string | null }>();
    expect(results).toHaveLength(2);
    expect(results[0]!.ip_hash).toBeNull();
    expect(results[1]!.ip_hash).toBe('new-hash');
  });
});

async function sha256Hex32(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
