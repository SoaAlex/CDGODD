import type { Context, Next } from 'hono';
import { sessionIdSchema } from '@cdgodd/shared';
import type { AppContext } from './env';

/**
 * ip_hash privacy window. Two mechanisms share it:
 * - the salt epoch below rotates every window, so hashes from different
 *   windows can never be correlated (effective anonymization over time);
 * - the daily cron (index.ts scheduled handler) nulls ip_hash on votes
 *   older than one window (GDPR data minimization).
 * Side effect: the per-item IP vote cap resets each window. Accepted.
 */
export const IP_HASH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Salted SHA-256 of the client IP. Raw IP is never persisted (GDPR). */
async function hashIp(ip: string, salt: string): Promise<string> {
  const epoch = Math.floor(Date.now() / IP_HASH_WINDOW_MS);
  const data = new TextEncoder().encode(`${salt}:${epoch}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/** Populates c.var.sessionId and c.var.ipHash for all routes. */
export async function identity(c: Context<AppContext>, next: Next) {
  const raw = c.req.header('x-session-id');
  const parsed = sessionIdSchema.safeParse(raw);
  c.set('sessionId', parsed.success ? parsed.data : null);

  const ip = c.req.header('cf-connecting-ip') ?? '0.0.0.0';
  c.set('ipHash', await hashIp(ip, c.env.IP_HASH_SALT ?? 'dev-salt'));
  await next();
}

/**
 * Verifies a Cloudflare Turnstile token. In local dev (no secret configured),
 * verification is skipped so the game is playable without keys.
 */
export async function verifyTurnstile(
  c: Context<AppContext>,
  token: string,
): Promise<boolean> {
  const secret = c.env.TURNSTILE_SECRET;
  if (!secret) return true; // dev mode
  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    },
  );
  const data = (await res.json()) as { success: boolean };
  return data.success;
}

/** Bearer-token guard for /admin routes (v1 auth; players never authenticate). */
export async function adminAuth(c: Context<AppContext>, next: Next) {
  const header = c.req.header('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!c.env.ADMIN_TOKEN || token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
}
