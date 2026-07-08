import { Hono } from 'hono';
import {
  normalizeLabel,
  submitItemSchema,
  type SubmissionResponse,
} from '@cdgodd/shared';
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
  const { label, lang, categoryKeys, turnstileToken } = parsed.data;

  const sessionId = c.get('sessionId');
  if (!sessionId) return c.json({ error: 'missing session id' }, 400);

  if (!(await verifyTurnstile(c, turnstileToken))) {
    return c.json({ error: 'turnstile failed' }, 403);
  }

  if (isBlocked(label)) {
    return c.json({ status: 'rejected' } satisfies SubmissionResponse, 200);
  }

  // Duplicate check: same normalized label already exists in this lang,
  // whatever its status. Normalization folds case/accents and drops a
  // leading French determiner, so "quinoa" matches "Le quinoa". Comparison
  // happens in JS (a scan of one lang's labels — small table, rare endpoint)
  // because SQLite can't fold accents or strip determiners.
  const wanted = normalizeLabel(label);
  const { results: existing } = await c.env.DB.prepare(
    `SELECT item_id, label FROM item_translations WHERE lang = ?1`,
  )
    .bind(lang)
    .all<{ item_id: number; label: string }>();
  const duplicate = existing.find((r) => normalizeLabel(r.label) === wanted);
  if (duplicate) {
    return c.json({
      status: 'duplicate',
      itemId: duplicate.item_id,
    } satisfies SubmissionResponse);
  }

  const item = await c.env.DB.prepare(
    `INSERT INTO items (status, submitted_by, created_at)
     VALUES ('pending', ?1, ?2) RETURNING id`,
  )
    .bind(sessionId, Date.now())
    .first<{ id: number }>();

  await c.env.DB.prepare(
    `INSERT INTO item_translations (item_id, lang, label) VALUES (?1, ?2, ?3)`,
  )
    .bind(item!.id, lang, label)
    .run();

  // Attach any known categories; unknown keys are silently skipped (player
  // input is only a hint — the admin fixes categories at approval time).
  for (const key of new Set(categoryKeys ?? [])) {
    await c.env.DB.prepare(
      `INSERT INTO item_categories (item_id, category_id)
       SELECT ?1, id FROM categories WHERE key = ?2`,
    )
      .bind(item!.id, key)
      .run();
  }

  return c.json({
    status: 'pending',
    itemId: item!.id,
  } satisfies SubmissionResponse);
});

export default submissions;
