# apps/api — AGENTS.md

`cdgodd-api` — Hono on Cloudflare Workers. The only backend. Owns D1, R2,
Workers AI, and the multiplayer Durable Object. See [`README.md`](README.md) for
bindings/secrets; this file is agent conventions. Root rules in
[`../../AGENTS.md`](../../AGENTS.md) still apply.

## Shape

- `src/index.ts` — app root. Global middleware `cors` then `identity`, then each
  route module mounted via `app.route()`. `Room` DO is re-exported here.
- `src/routes/*.ts` — one file per domain (`items`, `votes`, `submissions`,
  `reports`, `rooms`, `images`, `admin`). Add a route module + mount it in
  `index.ts`. `admin.ts` is large and bearer-gated (`ADMIN_TOKEN`).
- `src/durable/Room.ts` — multiplayer room state (Durable Object).
- `src/db/` — schema + `seed.sql`. `migrations/` holds ordered D1 migrations.
- `src/env.ts` — `Env` bindings + request `Variables` (`sessionId`, `ipHash`).
- `src/security.ts` — the `identity` middleware: session id + salted IP hash.

## Conventions

- **Bindings/context are typed in `src/env.ts`.** New binding → add to `Env` and
  to `wrangler.toml`. Access via `c.env.DB` etc.
- **Never store a raw IP.** Only `ipHash` (salted) is available on the context;
  keep it that way. Session id is a validated UUID or `null`.
- Request/response shapes come from `@cdgodd/shared` (zod). Validate input with
  the shared schema; don't hand-roll parsing per route.
- D1 access is raw SQL via `c.env.DB.prepare(...)`. Keep queries parameterized.

## Data — read before touching

- **Local only for iteration:** `pnpm db:migrate:local`, `pnpm db:seed:local`.
- **Never** `db:migrate:remote` or `wrangler d1 execute --remote` from a branch —
  every branch points at the *production* `cdgodd` DB. Remote migrations run
  automatically on `main` via CI.
- New migration = new numbered file in `migrations/`. Never edit an applied one.
- Renaming the `Room` DO class/binding can drop live rooms — needs a DO
  migration; coordinate first.

## Tests

`pnpm --dir apps/api test` — vitest + `@cloudflare/vitest-pool-workers`: tests
run inside real workerd with the real bindings (local D1, R2, the Room DO).
Conventions (`test/`):

- `test/setup.ts` applies migrations once per file and **reseeds before every
  test** (state persists within a file otherwise — the v4 pool isolates per
  FILE, not per test). Deterministic ids via the `sqlite_sequence` reset.
- Requests go through `SELF.fetch` via `test/helpers.ts` (`api()`, `vote()`).
  Note: workerd strips `cf-connecting-ip` — the identity middleware always
  sees `0.0.0.0` in tests.
- **Mock `globalThis.fetch`** (`vi.stubGlobal`) for anything external:
  Turnstile siteverify, Wikimedia/Pixabay, image-from-source bytes.
- **Never let `env.AI.run` call through** — the AI binding hits the real,
  billed API even locally. Replace it: `env.AI = { run: vi.fn(...) }`.
- Room DO: use the stub (`env.ROOMS.get(...)`) + WebSocket pairs;
  `runDurableObjectAlarm` for expiry. Never assert card order
  (`ORDER BY RANDOM()`).
- Tests assume the canonical seed (3 categories, 6 approved items).

## Verify

`pnpm --dir apps/api dev` (port 8787), then curl/drive the endpoint. Typecheck
with `pnpm --dir apps/api typecheck` (covers `test/` too).
