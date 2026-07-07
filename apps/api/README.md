# `cdgodd-api`

Cloudflare Worker (Hono) — the backend for the whole game.

- **Production:** https://api.cestdegaucheoudedroite.com
- **Config:** [`wrangler.toml`](wrangler.toml)

## Bindings

| Binding | Resource | Purpose |
|---------|----------|---------|
| `DB` | D1 database `cdgodd` | items, item_translations, categories, votes, reports |
| `IMAGES` | R2 bucket `cdgodd-images` | card images; served publicly at `images.cestdegaucheoudedroite.com` |
| `ROOMS` | Durable Object `Room` | one instance per multiplayer room code |

## Config & secrets

Plain vars live in `wrangler.toml`:

- `CDN_BASE` — public base URL for images (prod: the R2 custom domain). Local
  dev overrides it in `.dev.vars` to serve images through the Worker's `/img/*`
  route instead.

Secrets (set with `wrangler secret put`, never committed):

- `ADMIN_TOKEN` — bearer token guarding `/admin/*` routes.
- `IP_HASH_SALT` — salt for the per-request IP hash (raw IPs are never stored).
- `TURNSTILE_SECRET` — Cloudflare Turnstile secret. **When unset, Turnstile
  verification is skipped** (dev mode / not-yet-enabled), and the client's
  placeholder token is accepted; IP rate limiting + session dedupe still apply.

For local dev, copy `.dev.vars.example` → `.dev.vars`.

## Endpoints

Public (game):

- `GET  /deck?lang=fr&cursor=&limit=` — next batch of approved cards
- `POST /items/:id/vote` `{ side, turnstileToken }` — anonymous vote (dedupe by session)
- `GET  /items/search?q=&lang=fr` — free-search lookup
- `GET  /items/tallies?ids=1,2,3` — current global tallies (history page)
- `GET  /categories?lang=fr`
- `POST /submissions` `{ label, lang, categoryKey?, turnstileToken }` — propose an item (moderated)
- `POST /items/:id/report` `{ reason?, turnstileToken }`
- `GET  /img/*` — serve an R2 object (dev origin; prod uses the R2 domain)

Multiplayer (Durable Object):

- `POST /rooms` `{ mode, roundSize }` — create a room, returns a 6-char code
- `GET  /rooms/:code` — room state · `WS /rooms/:code/ws` — join & play

Admin (bearer `ADMIN_TOKEN`):

- `GET /admin/items?status=` · `PATCH /admin/items/:id` (approve/reject)
- `POST /admin/items` (multipart, image → R2) · `PATCH /admin/items/:id/image`
- `GET /admin/reports` · `GET /admin/stats`

## Database

Migrations live in [`migrations/`](migrations). Seed data:
[`src/db/seed.sql`](src/db/seed.sql).

```bash
pnpm db:migrate:local     # apply to the local dev D1
pnpm db:seed:local
pnpm db:migrate:remote    # apply to production D1 (CI does this on deploy)
```

## Run & deploy

```bash
pnpm dev        # wrangler dev on :8787
pnpm typecheck
pnpm deploy     # wrangler deploy → api.cestdegaucheoudedroite.com
```

CI applies remote migrations before deploying; when deploying manually, run
`pnpm db:migrate:remote` first if the schema changed.

## Dev environment

A separate Cloudflare stack served under `dev.` subdomains, with its **own**
D1 database and R2 bucket so dev traffic never touches prod data. Defined by the
`[env.dev]` block in [`wrangler.toml`](wrangler.toml) (worker `cdgodd-api-dev`).

| Prod | Dev |
|------|-----|
| `api.cestdegaucheoudedroite.com` | `api.dev.cestdegaucheoudedroite.com` |
| D1 `cdgodd` | D1 `cdgodd-dev` |
| R2 `cdgodd-images` (`images.cestdegaucheoudedroite.com`) | R2 `cdgodd-images-dev` (`images.dev.cestdegaucheoudedroite.com`) |

**One-time setup:**

```bash
wrangler d1 create cdgodd-dev        # paste the id into [env.dev] database_id
wrangler r2 bucket create cdgodd-images-dev
# In the dashboard: add custom domain images.dev.cestdegaucheoudedroite.com
#   to the cdgodd-images-dev bucket (R2 > bucket > Settings > Custom Domains).
wrangler secret put ADMIN_TOKEN --env dev
wrangler secret put TURNSTILE_SECRET --env dev   # optional; unset = skip check
pnpm db:migrate:dev
pnpm db:seed:dev
```

**Deploy:**

```bash
pnpm deploy:dev        # wrangler deploy --env dev
pnpm db:migrate:dev    # run first if the schema changed
```

Deploy the dev front-ends with `pnpm --filter @cdgodd/game deploy:dev` and
`pnpm --filter @cdgodd/admin deploy:dev` — both are built pointing at
`api.dev.cestdegaucheoudedroite.com`.
