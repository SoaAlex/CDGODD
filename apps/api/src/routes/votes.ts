import { Hono } from 'hono';
import { castVoteSchema, type VoteResponse } from '@cdgodd/shared';
import type { AppContext } from '../env';
import { verifyTurnstile } from '../security';

const votes = new Hono<AppContext>();

/**
 * POST /items/:id/vote
 * Anonymous vote. Each vote is recorded as a row (dedupe + attack rollback);
 * aggregate counters on items stay for cheap reads. One vote per item per
 * session_id — a re-vote from the same session is a no-op (idempotent).
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

  if (!(await verifyTurnstile(c, turnstileToken))) {
    return c.json({ error: 'turnstile failed' }, 403);
  }

  const item = await c.env.DB.prepare(
    `SELECT id FROM items WHERE id = ?1 AND status = 'approved'`,
  )
    .bind(itemId)
    .first();
  if (!item) return c.json({ error: 'item not found' }, 404);

  // Insert vote row; unique (item_id, session_id) makes re-votes no-ops.
  const inserted = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO votes (item_id, side, session_id, ip_hash, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(itemId, side, sessionId, c.get('ipHash'), Date.now())
    .run();

  if (inserted.meta.changes > 0) {
    const column = side === 'left' ? 'votes_left' : 'votes_right';
    await c.env.DB.prepare(
      `UPDATE items SET ${column} = ${column} + 1 WHERE id = ?1`,
    )
      .bind(itemId)
      .run();
  }

  const tally = await c.env.DB.prepare(
    `SELECT id AS itemId, votes_left AS votesLeft, votes_right AS votesRight
       FROM items WHERE id = ?1`,
  )
    .bind(itemId)
    .first<VoteResponse['tally']>();
  if (!tally) return c.json({ error: 'item not found' }, 404);

  return c.json({ tally } satisfies VoteResponse);
});

export default votes;
