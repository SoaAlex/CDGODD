import { Hono } from 'hono';
import { reportItemSchema } from '@cdgodd/shared';
import type { AppContext } from '../env';
import { verifyTurnstile } from '../security';
import { REPORT_AUTO_HIDE_THRESHOLD } from '../moderation';

const reports = new Hono<AppContext>();

/**
 * POST /items/:id/report — flag a conflictual item.
 * Crossing the threshold auto-hides the item (back to 'pending') until
 * an admin reviews it.
 */
reports.post('/items/:id/report', async (c) => {
  const itemId = Number(c.req.param('id'));
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return c.json({ error: 'bad item id' }, 400);
  }

  const parsed = reportItemSchema.safeParse(
    await c.req.json().catch(() => ({})),
  );
  if (!parsed.success) return c.json({ error: 'bad body' }, 400);

  if (!(await verifyTurnstile(c, parsed.data.turnstileToken))) {
    return c.json({ error: 'turnstile failed' }, 403);
  }

  await c.env.DB.prepare(
    `INSERT INTO reports (item_id, reason, reporter_session, created_at)
     VALUES (?1, ?2, ?3, ?4)`,
  )
    .bind(itemId, parsed.data.reason ?? null, c.get('sessionId'), Date.now())
    .run();

  await c.env.DB.prepare(
    `UPDATE items
        SET report_count = report_count + 1,
            status = CASE
              WHEN report_count + 1 >= ?2 THEN 'pending'
              ELSE status
            END
      WHERE id = ?1`,
  )
    .bind(itemId, REPORT_AUTO_HIDE_THRESHOLD)
    .run();

  return c.json({ ok: true });
});

export default reports;
