# AGENTS.md

Harness guide for AI agents working in this repo. Human-facing setup,
architecture, and deployment live in [`README.md`](README.md) and
[`docs/PLAN.md`](docs/PLAN.md) — read those for *what* the system is. This file
covers *how to work here safely*: conventions, verification, and the traps that
aren't obvious from the code.

## TL;DR

- pnpm 10 + Node 22 monorepo, Turborepo, TypeScript everywhere (strict).
- Three Workers (`apps/api`, `apps/admin`, `apps/game`) + one shared package.
- **The real correctness gate is `pnpm turbo typecheck`.** Run it before every
  commit. It is what CI runs and what the pre-commit hook enforces.
- **Every branch shares PRODUCTION D1 + R2 bindings.** There are no dev/staging
  data stores. See "Danger zones" below before touching data.

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
pnpm turbo typecheck              # THE correctness gate — run before committing
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
2. For anything the browser renders, drive it: start the relevant dev server via
   `preview_start`, then use the `preview_*` tools (snapshot, console, network).
   Never ask the human to check manually.
3. For API/data changes, hit the endpoint or drive the flow end-to-end.

`turbo lint` exists but only `apps/game` has a real lint script; treat lint as
advisory, not a gate. Typecheck is the gate.

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
- **Deploys happen in CI on push.** Every push to any branch uploads a preview
  version of the prod Workers; pushing to `main` deploys live. Commit/push only
  when asked.

## Finishing work

Commit finished work and keep docs in sync — if a change alters architecture,
commands, or contracts, update `README.md` / `docs/PLAN.md` / the relevant
`AGENTS.md` in the same commit. Conventional Commits (`feat:`, `fix:`, ...).
