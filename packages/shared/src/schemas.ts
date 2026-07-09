import { z } from 'zod';

export const sideSchema = z.enum(['left', 'right']);

export const langSchema = z
  .string()
  .regex(/^[a-z]{2}$/, 'ISO 639-1 code expected');

/** Anonymous, resettable device id (UUID v4 generated client-side). Not PII. */
export const sessionIdSchema = z.string().uuid();

export const castVoteSchema = z.object({
  side: sideSchema,
  turnstileToken: z.string().min(1),
});
export type CastVoteInput = z.infer<typeof castVoteSchema>;

/** Category key as stored in the DB: lowercase slug. */
export const categoryKeySchema = z.string().regex(/^[a-z0-9-]{1,50}$/);

export const deckQuerySchema = z.object({
  lang: langSchema.default('fr'),
  cursor: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  /** CSV of category keys; only items in at least one of them are dealt. */
  categories: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(categoryKeySchema).max(20))
    .optional(),
});
export type DeckQuery = z.infer<typeof deckQuerySchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  lang: langSchema.default('fr'),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const submitItemSchema = z.object({
  label: z.string().trim().min(1).max(80),
  lang: langSchema.default('fr'),
  categoryKeys: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  turnstileToken: z.string().min(1),
});
export type SubmitItemInput = z.infer<typeof submitItemSchema>;

export const reportItemSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  turnstileToken: z.string().min(1),
});
export type ReportItemInput = z.infer<typeof reportItemSchema>;

export const createRoomSchema = z.object({
  mode: z.enum(['batch', 'live']).default('batch'),
  roundSize: z.coerce.number().int().min(5).max(50).default(10),
  /** Empty/absent = deal from every category. */
  categoryKeys: z.array(categoryKeySchema).max(20).default([]),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

/** Room short codes: 6 unambiguous uppercase chars. */
export const roomCodeSchema = z
  .string()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/, 'invalid room code');
