import { Hono } from 'hono';
import { submitItemSchema, type SubmissionResponse } from '@cdgodd/shared';
import type { AppContext } from '../env';
import { verifyTurnstile } from '../security';
import { isBlocked } from '../moderation';

const submissions = new Hono<AppContext>();

/**
 * POST /submissions — free-search mode "propose a new item".
 * Blocklist rejects offensive content up front; everything else lands in
 * the admin approval queue as status='pending'.
 */
submissions.post('/submissions', async (c) => {
  const parsed = submitItemSchema.safeParse(
    await c.req.json().catch(() => ({})),
  );
  if (!parsed.success) return c.json({ error: 'bad body' }, 400);
  const { label, lang, categoryKey, turnstileToken } = parsed.data;

  const sessionId = c.get('sessionId');
  if (!sessionId) return c.json({ error: 'missing session id' }, 400);

  if (!(await verifyTurnstile(c, turnstileToken))) {
    return c.json({ error: 'turnstile failed' }, 403);
  }

  if (isBlocked(label)) {
    return c.json({ status: 'rejected' } satisfies SubmissionResponse, 200);
  }

  const category = categoryKey
    ? await c.env.DB.prepare(`SELECT id FROM categories WHERE key = ?1`)
        .bind(categoryKey)
        .first<{ id: number }>()
    : null;

  const item = await c.env.DB.prepare(
    `INSERT INTO items (category_id, status, submitted_by, created_at)
     VALUES (?1, 'pending', ?2, ?3) RETURNING id`,
  )
    .bind(category?.id ?? null, sessionId, Date.now())
    .first<{ id: number }>();

  await c.env.DB.prepare(
    `INSERT INTO item_translations (item_id, lang, label) VALUES (?1, ?2, ?3)`,
  )
    .bind(item!.id, lang, label)
    .run();

  return c.json({
    status: 'pending',
    itemId: item!.id,
  } satisfies SubmissionResponse);
});

export default submissions;
