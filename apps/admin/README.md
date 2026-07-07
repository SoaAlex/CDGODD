# `cdgodd-admin-v2`

React + Vite moderation panel, deployed as an assets-only Cloudflare Worker.

- **Production:** https://admin.cestdegaucheoudedroite.com
- **Config:** [`wrangler.toml`](wrangler.toml)

> The Worker is named `cdgodd-admin-v2` (not `cdgodd-admin`) because the older
> V1 attempt still owns `cdgodd-admin` / `adminv1.cestdegaucheoudedroite.com`.

## What it does

Three tabs, all talking to the API with a bearer token:

- **Modération** — pending/approved/rejected queue with image thumbnails;
  approve (✓) or reject (✗).
- **Créer un item** — create an item with a French label, category, and image
  (uploaded to R2); goes live immediately.
- **Signalements** — reported items, most-reported first.

Auth is v1-simple: paste the API's `ADMIN_TOKEN` into the token field (kept in
`sessionStorage`). Every request sends `Authorization: Bearer <token>`.

## Config

- `VITE_API_URL` — API base URL, baked in at build time. In production CI sets
  it to `https://api.cestdegaucheoudedroite.com`. Unset in local dev, so it
  falls back to `/api`, which Vite proxies to `http://localhost:8787`
  (see [`vite.config.ts`](vite.config.ts)).

## Run & deploy

```bash
pnpm dev         # vite dev server on :5173 (proxies /api → :8787)
pnpm build       # tsc + vite build → dist/
pnpm typecheck
pnpm deploy      # build + wrangler deploy → admin.cestdegaucheoudedroite.com
```
