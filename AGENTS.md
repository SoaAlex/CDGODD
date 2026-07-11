# AGENTS.md

Harness guide for AI agents working in this repo. Human-facing setup,
architecture, and deployment live in [`README.md`](README.md) and
[`docs/PLAN.md`](docs/PLAN.md) — read those for *what* the system is. This file
covers *how to work here safely*: conventions, verification, and the traps that
aren't obvious from the code.

## TL;DR

- pnpm 10 + Node 22 monorepo, Turborepo, TypeScript everywhere (strict).
- Three Workers (`apps/api`, `apps/admin`, `apps/game`) + one shared package +
  an `e2e/` Playwright workspace.
- **Correctness gates: `pnpm turbo typecheck` then `pnpm test`.** Both run in
  CI before any deploy; the pre-commit hook enforces typecheck.
- **Every branch shares PRODUCTION D1 + R2 bindings.** There are no dev/staging
  data stores. See "Danger zones" below before touching data. Tests never
  touch prod: API tests run in workerd with per-file isolated D1; e2e runs
  against `wrangler dev --local` with its own persist dir.

## Layout

| Path | Worker | Role |
|------|--------|------|
| `apps/api` | `cdgodd-api` | Hono API. Owns D1, R2, Durable Objects (multiplayer `Room`), admin, image serving. The only backend. |
| `apps/admin` | `cdgodd-admin-v2` | React + Vite moderation panel. Assets-only Worker. Talks to the API. |
| `apps/game` | `cdgodd-game` | Expo (React Native) — web + iOS + Android. Web export served as assets-only Worker. |
| `packages/shared` | — | `@cdgodd/shared`: zod schemas, types, API contracts, i18n. Imported by all apps. |

Per-app detail lives in each app's own `AGENTS.md` and `README.md`.

## Commands

Run from repo root unless noted. Turbo caches, so repeated runs are cheap.

```bash
pnpm install                      # Node 22, pnpm 10
pnpm turbo typecheck              # gate 1 — run before committing
pnpm test                         # gate 2 — shared units + API workerd tests
pnpm test:e2e                     # Playwright (boots api :8789 / admin :5178 / game :8082)
pnpm turbo build
pnpm --dir apps/api dev           # API  → http://localhost:8787
pnpm --dir apps/admin dev         # Admin → http://localhost:5173 (proxies /api → 8787)
pnpm --dir apps/game exec expo start --web   # Game → http://localhost:8081
```

Prefer the `preview_start` launch configs in
[`.claude/launch.json`](.claude/launch.json) over raw `dev` when verifying in a
browser.

## Verifying a change

Do not claim a change works until it is exercised. Order of trust:

1. `pnpm turbo typecheck` — must pass. Non-negotiable.
2. `pnpm test` — shared unit tests + API integration tests (real workerd via
   `@cloudflare/vitest-pool-workers`: real local D1/R2/DO, migrations + seed
   applied per test file, reseeded before every test).
3. For anything the browser renders, drive it: start the relevant dev server via
   `preview_start`, then use the `preview_*` tools (snapshot, console, network).
   Never ask the human to check manually. `pnpm test:e2e` covers the main
   admin + game flows end-to-end.

`turbo lint` exists but only `apps/game` has a real lint script; treat lint as
advisory, not a gate.

Test layout: `packages/shared/src/*.test.ts` (pure units),
`apps/api/test/*.test.ts` (integration, see `apps/api/AGENTS.md`),
`e2e/tests/**` (Playwright, ports 8789/5178/8082, admin token
`cdgodd-e2e-token`). API tests and e2e specs assume the canonical
`apps/api/src/db/seed.sql` (3 categories, 6 approved items) — changing the
seed means updating tests.

## Conventions

- **Contracts live in `packages/shared`.** Types, zod schemas, and API request/
  response shapes go there so all three apps stay in sync. Changing an API shape
  means editing `shared` first, then the API, then the consumers.
- **TypeScript is strict**, including `noUncheckedIndexedAccess`. Indexed access
  can be `undefined` — handle it, don't cast it away.
- Match surrounding style; no repo-wide formatter is enforced.
- **Anonymous by design.** No login, 100% anonymous, GDPR-friendly. Do not add
  anything that identifies or tracks a user. Vote integrity is done without
  identity (Turnstile + IP-hash rate limit + per-session dedupe).

## Danger zones

- **Branches share prod D1/R2.** Preview deploys (any non-`main` branch) run
  against the *production* database and image bucket. There is no isolated dev
  data. Never run `db:migrate:remote` or destructive `wrangler d1 execute
  --remote` from a branch. Local work uses `--local` only.
- **Migrations apply on `main` only**, automatically in CI
  ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). Add a new
  file under `apps/api/migrations/`; never mutate an already-applied migration.
- **Durable Objects** (`apps/api/src/durable/Room.ts`) hold live multiplayer
  state. Renaming a DO class or its binding needs a migration and can drop
  active rooms — coordinate, don't rename casually.
- **Recovery nets if prod data gets damaged:** D1 Time Travel (30-day PITR,
  `wrangler d1 time-travel restore`) plus a daily gzipped SQL dump to the
  private `cdgodd-backups` R2 bucket
  ([`.github/workflows/backup.yml`](.github/workflows/backup.yml), 90-day
  retention, see README "Backups"). Nets, not a license — rules above still
  apply.
- **Deploys happen in CI on push.** Every push to any branch uploads a preview
  version of the prod Workers; pushing to `main` deploys live. CI gates:
  typecheck + `turbo test` (blocking); Playwright e2e runs as a parallel
  non-blocking job on `main`. Commit/push only when asked.

## Finishing work

Commit finished work and keep docs in sync — if a change alters architecture,
commands, or contracts, update `README.md` / `docs/PLAN.md` / the relevant
`AGENTS.md` in the same commit. Conventional Commits (`feat:`, `fix:`, ...).
