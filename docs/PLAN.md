# CDGODD — Implementation Plan

A Tinder-style swipe game: classify random objects/concepts as **gauche** (left) or **droite** (right). Solo + multiplayer, multilingual, ad-supported, multiplatform.

## 0. Core principles

- **No login, ever.** Play is 100% anonymous. No accounts, no email, no auth for players.
- **GDPR-friendly by default.** No personal data collected to play. The only data collection is **ads** (AdMob/AdSense cookies + identifiers), which is gated behind a consent prompt — decline = non-personalized ads or none. Nothing else needs consent.
- **Statistics must be attack-resistant.** Because anyone can vote anonymously, the vote pipeline must resist stuffing/bots without identifying users. See §5 "Anonymity & vote integrity".
- **Pseudonymous, not identifying.** A random device-generated `session_id` (local storage, resettable, never tied to a person) is used only for soft dedupe and abuse rollback. It is not PII and is never required to play.

---

## 1. Stack (locked)

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere |
| Repo | pnpm workspaces + Turborepo (monorepo) |
| Game client | Expo (React Native) → iOS + Android + Web (React Native Web) |
| Admin client | React + Vite → Cloudflare Pages |
| Backend API | Cloudflare Workers (Hono router) |
| Database | Cloudflare **D1** (SQLite) |
| Images | Cloudflare R2 (storage, zero egress) + Cloudflare Images (resize/WebP) |
| Realtime | Durable Objects + WebSockets |
| Ads | AdMob on mobile, AdSense/none on web (`Platform.OS` conditional) |
| Validation | zod schemas shared across client/server |

**Target cost: $0–5/month** until meaningful traffic.

---

## 2. Monorepo layout

```
CDGODD-V2/
├─ package.json                 # pnpm workspace root
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ docs/
│  └─ PLAN.md
├─ packages/
│  ├─ shared/                   # types, zod schemas, constants, i18n keys
│  │  ├─ src/
│  │  │  ├─ models.ts           # Item, Vote, Report, Category types
│  │  │  ├─ schemas.ts          # zod: submitItem, castVote, report, etc.
│  │  │  ├─ api.ts              # request/response contracts
│  │  │  └─ i18n/
│  │  │     ├─ fr.json
│  │  │     └─ index.ts
│  │  └─ package.json
│  └─ config/                   # shared eslint/tsconfig presets
├─ apps/
│  ├─ api/                      # Cloudflare Worker
│  │  ├─ src/
│  │  │  ├─ index.ts            # Hono app + route mounting
│  │  │  ├─ routes/
│  │  │  │  ├─ items.ts
│  │  │  │  ├─ votes.ts
│  │  │  │  ├─ submissions.ts
│  │  │  │  ├─ reports.ts
│  │  │  │  ├─ rooms.ts
│  │  │  │  └─ admin.ts
│  │  │  ├─ db/
│  │  │  │  ├─ schema.sql
│  │  │  │  ├─ migrations/
│  │  │  │  └─ queries.ts
│  │  │  ├─ durable/
│  │  │  │  └─ Room.ts          # Durable Object for multiplayer rooms
│  │  │  ├─ moderation.ts       # blocklist + model call
│  │  │  └─ images.ts           # R2 upload / signed URL helpers
│  │  ├─ wrangler.toml
│  │  └─ package.json
│  ├─ game/                     # Expo app
│  │  ├─ app/                   # expo-router screens
│  │  │  ├─ index.tsx           # Menu
│  │  │  ├─ solo/               # random + free-search
│  │  │  ├─ multiplayer/        # join/create room, play, results
│  │  │  └─ settings.tsx
│  │  ├─ src/
│  │  │  ├─ components/         # SwipeDeck, Card, VoteBar, AdSlot
│  │  │  ├─ hooks/              # useDeck, useImagePreload, useRoom
│  │  │  ├─ api/                # typed client (from packages/shared)
│  │  │  └─ ads/                # AdMob (native) + AdSense (web) shims
│  │  ├─ app.json
│  │  └─ package.json
│  └─ admin/                    # React + Vite
│     ├─ src/
│     │  ├─ pages/              # Dashboard, Items, Submissions queue, Reports
│     │  ├─ components/
│     │  └─ api/
│     └─ package.json
```

---

## 3. Database schema (D1 / SQLite)

```sql
CREATE TABLE categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT UNIQUE NOT NULL          -- slug, e.g. 'food'
);

CREATE TABLE category_translations (
  category_id INTEGER NOT NULL REFERENCES categories(id),
  lang        TEXT NOT NULL,                -- 'fr'
  name        TEXT NOT NULL,
  PRIMARY KEY (category_id, lang)
);

CREATE TABLE items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  image_key   TEXT,                         -- R2 object key, NOT full URL
  votes_left  INTEGER NOT NULL DEFAULT 0,
  votes_right INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  submitted_by TEXT,                        -- session id, nullable
  created_at  INTEGER NOT NULL,             -- epoch ms
  -- Image attribution (migration 0003): all NULL = manual upload, no credit.
  image_source TEXT,                        -- 'wikimedia' | 'pixabay' | 'ai'
  image_author TEXT,                        -- plain text, HTML stripped
  image_license TEXT,                       -- 'CC BY-SA 4.0' | 'Public domain' | … | 'ai-generated'
  image_source_url TEXT                     -- Commons file page / Pixabay page
);
CREATE INDEX idx_items_status ON items(status);

-- Items can belong to several categories (migration 0002).
CREATE TABLE item_categories (
  item_id     INTEGER NOT NULL REFERENCES items(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  PRIMARY KEY (item_id, category_id)
);

CREATE TABLE item_translations (
  item_id     INTEGER NOT NULL REFERENCES items(id),
  lang        TEXT NOT NULL,                -- 'fr' only for now
  label       TEXT NOT NULL,
  PRIMARY KEY (item_id, lang)
);

CREATE TABLE reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER NOT NULL REFERENCES items(id),
  reason      TEXT,
  reporter_session TEXT,
  created_at  INTEGER NOT NULL
);

-- Core (needed for dedupe + abuse rollback in an anonymous system):
CREATE TABLE votes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER NOT NULL REFERENCES items(id),
  side        TEXT NOT NULL,                -- 'left' | 'right'
  session_id  TEXT,                         -- pseudonymous device id, not PII
  ip_hash     TEXT,                         -- salted hash of IP, for rate/abuse only
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_votes_dedupe ON votes(item_id, session_id);
CREATE INDEX idx_votes_iphash ON votes(item_id, ip_hash);
```

**Vote writes**: aggregate counters on `items` stay for cheap reads, but each vote is **also** recorded in `votes` (upsert on `item_id + session_id`). This is required — not optional — because it's the only way to dedupe and to *roll back* a detected stuffing attack (delete offending rows, recompute counters). `ip_hash` is a salted, rotating hash used purely for rate limiting/anomaly detection; the raw IP is never stored.

---

## 4. API endpoints

All write endpoints carry a **Cloudflare Turnstile token** (privacy-friendly, no PII) and an anonymous `session_id` header; the Worker rate-limits by `ip_hash` before touching the DB.

**Public (game):**
- `GET  /deck?lang=fr&cursor=…&limit=25` → next batch of approved items (label + image URL + current tallies, so the client can show results optimistically)
- `POST /items/:id/vote` `{ side, turnstileToken }` → single batched D1 transaction: insert vote (no-op on dupe), bump counters, return tallies
- `GET  /items/search?q=…&lang=fr` → free-search mode lookup
- `POST /submissions` `{ label, categoryKeys, image, turnstileToken }` → moderation → `pending` or auto-reject
- `POST /items/:id/report` `{ reason, turnstileToken }` → increments report_count, inserts report row

**Multiplayer (rooms):**
- `POST /rooms` → create room, returns short code (routes to a Durable Object)
- `GET  /rooms/:code` → room meta / status
- `WS   /rooms/:code/ws` → join, receive cards, submit votes, get reveals

**Admin (authenticated):**
- `GET  /admin/items` (filter by status), `PATCH /admin/items/:id` (approve/reject/edit)
- `POST /admin/items` (create + upload image to R2)
- `GET  /admin/image-candidates?q=` (free-license search: Wikimedia Commons + Pixabay)
- `POST /admin/items/:id/image-from-source` (copy candidate → R2 + attribution)
- `POST /admin/items/:id/ai-image` (Workers AI flux-1-schnell fallback)
- `GET  /admin/submissions` (pending queue)
- `GET  /admin/reports` (flagged items)
- `GET  /admin/stats` (vote distributions, top items)

Admin auth: simplest viable = Cloudflare Access in front of the admin routes/Pages, or a shared bearer token in env for v1.

---

## 5. Key subsystems

**Image pipeline**: admin uploads → Worker puts object in R2 → store `image_key`. Client builds URL as `${CDN_BASE}/${image_key}` (optionally via Cloudflare Images variant for size/WebP). Swapping CDN never requires a DB migration.

**Image sourcing (copyright-safe)**: user submissions are label-only, so the admin picker (`ImagePicker` in the edit modal) searches **Wikimedia Commons** (real entities; no key) + **Pixabay** (generic concepts; `PIXABAY_KEY` secret) at review time, filtered to genuinely free licenses (CC0/PD/CC BY/CC BY-SA — no NC/ND). Picking a candidate copies the image server-side to R2 and stores attribution on the item; `DeckCard.imageAttribution` drives an ⓘ credit overlay on the card (author + license + source link, as CC BY requires). Fallback: **Workers AI flux-1-schnell** generation (~$0.001/image), stored as `image_license='ai-generated'` → "IA" badge, no credit. Gotchas encoded in `image-sources.ts`: Wikimedia requires a descriptive User-Agent and only serves fixed thumb-width buckets (330px ok, 320px → 400).

**Preloading**: `useDeck` fetches 25 items per call; `useImagePreload` prefetches the next 3–5 card images (`Image.prefetch`) while the top card is shown. Refetch when ~5 cards remain. Deck cards carry their global tallies, so vote results render instantly (own vote added optimistically, reconciled by the vote response); on web, a Turnstile token is pre-minted in the background so votes never wait on the challenge.

**Multiplayer (Durable Object `Room`)**: one instance per short code. Holds player list + current card + in-memory vote tally. Two modes:
- *Batch (build first)*: players vote through N cards, DO reveals aggregated results at the end.
- *Live (later)*: DO broadcasts running average after each vote. Same object, extra broadcast — no re-architecture.

**Moderation (`moderation.ts`)**: on submission → (1) regex/wordlist blocklist, (2) free moderation model call → auto-reject offensive; else enqueue as `pending`. Reports increment `report_count`; crossing threshold auto-hides pending admin review.

**Anonymity & vote integrity**: no login, so integrity is layered defense, not identity —
- **Cloudflare Turnstile** on vote/submit/report → blocks headless bots without a CAPTCHA-for-humans, no personal data.
- **Cloudflare Rate Limiting + WAF** and Worker-side `ip_hash` throttle (salted, rotating hash — raw IP never stored) → caps votes per IP/window.
- **Soft dedupe**: unique `(item_id, session_id)` → one vote per item per device; a reset session gets throttled by the IP layer instead.
- **Anomaly detection & rollback**: because every vote is a row in `votes`, a spike from one `ip_hash`/session is detectable and *reversible* — delete offending rows and recompute counters. A scheduled Worker (cron) can flag outliers.
- **Displayed averages** can trim outliers (e.g. drop contributions above a per-source cap) so a burst can't swing the shown result even before cleanup.
- Multiplayer rooms: vote validity is enforced in the room's Durable Object (one vote per connected player per card), immune to external stuffing.

**i18n**: UI strings in `packages/shared/i18n/*.json` (i18next). Item labels from `item_translations` (fr now, table ready for more langs). Locale detected on device, overridable in Settings.

**Ads & consent (`src/ads/`)**: `AdSlot` component. `Platform.OS !== 'web'` → AdMob banner/interstitial (e.g. interstitial every N swipes); `web` → AdSense unit or nothing. Mobile is the real revenue surface. **Ads are the only data-collecting feature**, so they sit behind a consent flow: **Google UMP SDK** (mobile) / **IAB TCF CMP** (web) shows a consent prompt on first ad; decline → non-personalized ads (or none). The game itself never blocks on consent — you can play immediately, consent is asked only when an ad would show.

---

## 6. Build order (phased milestones)

**M0 — Scaffold**
- pnpm workspace, Turborepo, tsconfig base, three app skeletons, `packages/shared`.

**M1 — Data spine**
- D1 schema + migrations, seed a few French items with images in R2.
- `packages/shared` models + zod schemas.
- API: `GET /deck`, `POST /items/:id/vote`.

**M2 — Solo game (random)**
- Menu screen, SwipeDeck + Card, vote on swipe, deck batching + image preload.
- No ads, no multiplayer yet. Playable end-to-end.

**M3 — Admin + moderation**
- Admin app: item list, create item (image upload to R2), approve/reject.
- Submission endpoint + moderation filter. Free-search + submit flow in game.
- Reports endpoint + reports view.

**M4 — Multiplayer (batch mode)**
- Durable Object `Room`, create/join by code, WebSocket play, end-of-round reveal.

**M5 — Ads + i18n polish**
- AdMob (mobile) + web fallback via `AdSlot`. i18n wiring, Settings screen.

**M6 — Live multiplayer + hardening**
- Live-reveal mode, rate limiting, analytics dashboard, deploy pipelines.

---

## 7. Deployment

- **api**: `wrangler deploy` (Worker + D1 + R2 + DO bindings in `wrangler.toml`).
- **admin**: Cloudflare Pages (behind Cloudflare Access).
- **game web**: `expo export --platform web` → Cloudflare Pages.
- **game mobile**: EAS Build → App Store / Play Store.

---

## 8. Open decisions (not blocking scaffold)

- Admin auth: Cloudflare Access vs bearer token for v1. *(Players never authenticate — this is admin-only.)*
- Category list: fixed seed set vs admin-managed from day one.
- Multiplayer default mode at launch (batch is built first regardless).
- Vote-integrity thresholds: per-IP rate limits, outlier cap %, auto-rollback trigger — tune with real traffic.

**Resolved:** player identity = anonymous, resettable device `session_id` (pseudonymous, not PII); no accounts. GDPR clean; only ads collect data, behind consent.
