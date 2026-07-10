import { Hono } from 'hono';
import { castVoteSchema, type VoteResponse } from '@cdgodd/shared';
import type { AppContext } from '../env';
import { verifyTurnstile } from '../security';

const votes = new Hono<AppContext>();

/**
 * Ballot-stuffing backstop: max distinct votes per item from one ip_hash.
 * High enough for shared IPs (household NAT, CGNAT mobile carriers), low
 * enough to make session-id cycling pointless.
 */
const MAX_VOTES_PER_ITEM_PER_IP = 5;

/**
 * POST /items/:id/vote
 * Anonymous vote. Each vote is recorded as a row (dedupe + attack rollback);
 * aggregate counters on items stay for cheap reads. One vote per item per
 * session_id — a re-vote from the same session is a no-op (idempotent).
 * Votes beyond MAX_VOTES_PER_ITEM_PER_IP from one ip_hash are also silent
 * no-ops, so cycling session ids can't stuff the ballot.
 */
votes.post('/items/:id/vote', async (c) => {
  const itemId = Number(c.req.param('id'));
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return c.json({ error: 'bad item id' }, 400);
  }

  const parsed = castVoteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'bad body' }, 400);
  const { side, turnstileToken } = parsed.data;

  const sessionId = c.get('sessionId');
  if (!sessionId) return c.json({ error: 'missing session id' }, 400);

  // Edge flood guard (Workers rate-limit binding, sliding window per IP).
  // Complements the persistent per-item cap below; absent in tests/local.
  if (c.env.VOTE_LIMITER) {
    const { success } = await c.env.VOTE_LIMITER.limit({
      key: c.get('ipHash'),
    });
    if (!success) return c.json({ error: 'rate limited' }, 429);
  }

  if (!(await verifyTurnstile(c, turnstileToken))) {
    return c.json({ error: 'turnstile failed' }, 403);
  }

  // One D1 round trip. batch() runs sequentially on one connection inside a
  // transaction, so statement 2 can read changes() from statement 1: the
  // counter only moves when the INSERT actually landed (not a dupe, item
  // approved, IP under cap). Unique (item_id, session_id) makes re-votes
  // no-ops; the ip_hash cap (idx_votes_iphash) blocks session-id cycling.
  const [, , tallyRes] = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO votes (item_id, side, session_id, ip_hash, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5
        WHERE EXISTS (SELECT 1 FROM items WHERE id = ?1 AND status = 'approved')
          AND (SELECT COUNT(*) FROM votes
                WHERE item_id = ?1 AND ip_hash = ?4) < ?6`,
    ).bind(
      itemId,
      side,
      sessionId,
      c.get('ipHash'),
      Date.now(),
      MAX_VOTES_PER_ITEM_PER_IP,
    ),
    c.env.DB.prepare(
      `UPDATE items
          SET votes_left  = votes_left  + (?2 = 'left') * changes(),
              votes_right = votes_right + (?2 = 'right') * changes()
        WHERE id = ?1`,
    ).bind(itemId, side),
    c.env.DB.prepare(
      `SELECT id AS itemId, votes_left AS votesLeft, votes_right AS votesRight
         FROM items WHERE id = ?1 AND status = 'approved'`,
    ).bind(itemId),
  ]);

  const tally = tallyRes!.results[0] as VoteResponse['tally'] | undefined;
  if (!tally) return c.json({ error: 'item not found' }, 404);

  return c.json({ tally } satisfies VoteResponse);
});

export default votes;
