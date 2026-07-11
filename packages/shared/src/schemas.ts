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

/** 'any' = item in at least one selected category; 'all' = in every one. */
export const categoryMatchSchema = z.enum(['any', 'all']);
export type CategoryMatch = z.infer<typeof categoryMatchSchema>;

export const deckQuerySchema = z.object({
  lang: langSchema.default('fr'),
  cursor: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  /** CSV of category keys; items must match them per `match`. */
  categories: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(categoryKeySchema).max(100))
    .optional(),
  /** How `categories` combine; ignored when the filter is empty. */
  match: categoryMatchSchema.default('any'),
  /**
   * CSV of category keys to exclude: items in any of them are dropped.
   * Applied after `categories` (an item both included and excluded is
   * excluded).
   */
  exclude: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(categoryKeySchema).max(100))
    .optional(),
  /**
   * Per-session shuffle seed. When present the deck is ordered by a
   * deterministic permutation of item ids instead of ascending id, so each
   * play session sees a different order. Bounded to keep `id * seed` inside
   * SQLite's exact-integer range. Absent = legacy ascending-id order.
   */
  seed: z.coerce.number().int().positive().max(1_000_000_000).optional(),
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
  categoryKeys: z.array(categoryKeySchema).max(100).default([]),
  /** How `categoryKeys` combine; ignored when the filter is empty. */
  categoryMatch: categoryMatchSchema.default('any'),
  /** Categories to exclude: items in any of them are never dealt. */
  excludeKeys: z.array(categoryKeySchema).max(100).default([]),
  /**
   * Host-provided words/phrases dealt as image-less cards. Empty = classic
   * DB-only round.
   */
  customWords: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  /**
   * With customWords: also mix in `roundSize` random DB items. Ignored when
   * customWords is empty (a round always needs cards).
   */
  includeDbItems: z.boolean().default(true),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

/** Room short codes: 6 unambiguous uppercase chars. */
export const roomCodeSchema = z
  .string()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/, 'invalid room code');
