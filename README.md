# C'est de Gauche ou de Droite ?

A Tinder-style swipe game: classify random objects and concepts as **gauche**
(left) or **droite** (right). Solo + multiplayer, multilingual, anonymous,
ad-supported, multiplatform.

- **Game (web + iOS + Android):** https://cestdegaucheoudedroite.com
- **API:** https://api.cestdegaucheoudedroite.com
- **Admin:** https://admin.cestdegaucheoudedroite.com
- **Images (R2):** https://images.cestdegaucheoudedroite.com

## Monorepo layout

pnpm workspaces + Turborepo, TypeScript throughout.

| Path | Worker | What it is |
|------|--------|------------|
| [`apps/api`](apps/api) | `cdgodd-api` | Hono API on Cloudflare Workers: deck, votes, search, submissions, reports, multiplayer rooms (Durable Objects), admin, R2 image serving. Owns D1 + R2. |
| [`apps/admin`](apps/admin) | `cdgodd-admin-v2` | React + Vite moderation panel (assets-only Worker). |
| [`apps/game`](apps/game) | `cdgodd-game` | Expo (React Native) app; the web export is served as an assets-only Worker. |
| [`packages/shared`](packages/shared) | — | Shared types, zod schemas, API contracts, French i18n. |

Design decisions, schema, and milestone history: [`docs/PLAN.md`](docs/PLAN.md).

## Architecture

```
Expo game (web/iOS/Android) ─┐
React admin panel ───────────┼──► api.cestdegaucheoudedroite.com (Worker, Hono)
                             │        ├─ D1 (SQLite)         — items, votes, reports
                             │        ├─ R2 (cdgodd-images)  — card images
                             │        ├─ Workers AI          — admin image generation
                             │        └─ Durable Objects     — multiplayer rooms
                             └──► images.cestdegaucheoudedroite.com (R2 custom domain)
```

Core principles: **no login, 100% anonymous** (GDPR-friendly; only ads collect
data, behind consent). Vote integrity without identity: Turnstile + IP-hash
rate limiting + per-session dedupe, with every vote stored as a reversible row.

## Local development

Prerequisites: Node 22, pnpm 10.

```bash
pnpm install
```

Copy the example env files and create the local D1 database:

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars      # ADMIN_TOKEN, CDN_BASE (+ optional PIXABAY_KEY)
cd apps/api
pnpm db:migrate:local
pnpm db:seed:local
```

Run the three dev servers (each in its own terminal, or via the Claude
`preview_start` launch configs in [`.claude/launch.json`](.claude/launch.json)):

| App | Command | URL |
|-----|---------|-----|
| API | `pnpm --dir apps/api dev` | http://localhost:8787 |
| Admin | `pnpm --dir apps/admin dev` | http://localhost:5173 (proxies `/api` → 8787) |
| Game (web) | `pnpm --dir apps/game exec expo start --web` | http://localhost:8081 |

Useful root scripts: `pnpm turbo typecheck`, `pnpm turbo build`.

## Deployment

**CI (recommended):** every push to `main` runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — typecheck,
apply D1 migrations, then deploy all three Workers. Requires repo secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

**Manual** (needs `CLOUDFLARE_API_TOKEN` in the environment):

```bash
pnpm --dir apps/api deploy      # migrations must be applied separately (see apps/api)
pnpm --dir apps/admin deploy
pnpm --dir apps/game deploy
```

See each app's README for its own bindings, secrets, and env vars.
