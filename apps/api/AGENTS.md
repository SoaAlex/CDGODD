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

## Verify

`pnpm --dir apps/api dev` (port 8787), then curl/drive the endpoint. Typecheck
with `pnpm --dir apps/api typecheck`.
