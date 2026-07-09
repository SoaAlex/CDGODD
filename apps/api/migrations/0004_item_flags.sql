-- Per-item moderation flags (booleans, stored 0/1).
-- not_mobile: content not suitable for mobile display.
-- nsfw: not safe for work / sensitive content.
-- Labels are display-only and may be renamed in the admin UI (see
-- apps/admin/src/lib/flags.ts) — the column names stay stable.
ALTER TABLE items ADD COLUMN not_mobile INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN nsfw       INTEGER NOT NULL DEFAULT 0;
