# `cdgodd-admin-v2`

React + Vite + Tailwind moderation panel with a sidebar layout and client-side
routing (`react-router-dom`), deployed as an assets-only Cloudflare Worker.

- **Production:** https://admin.cestdegaucheoudedroite.com
- **Config:** [`wrangler.toml`](wrangler.toml)

> The Worker is named `cdgodd-admin-v2` (not `cdgodd-admin`) because the older
> V1 attempt still owns `cdgodd-admin` / `adminv1.cestdegaucheoudedroite.com`.

## What it does

A sidebar-navigated SPA, all talking to the API with a bearer token:

- **Dashboard** (`/`) — stat cards (approved/pending/rejected/reports) plus a
  moderation-queue preview.
- **Modération** (`/items`) — pending/approved/rejected queue with image
  thumbnails and status badges; approve, reject, or reset to pending.
- **Créer un item** (`/add-item`) — create an item with a French label,
  category, and drag-and-drop image (uploaded to R2); goes live immediately.
- **Signalements** (`/reports`) — reported items, most-reported first.

Auth is v1-simple: paste the API's `ADMIN_TOKEN` on the `/login` screen. It is
verified against `GET /admin/stats`, kept in `sessionStorage`, and sent as
`Authorization: Bearer <token>` on every request. `ProtectedRoute` redirects to
`/login` when no token is present.

## Structure

```
src/
  App.tsx              routes + AuthProvider
  hooks/useAuth.tsx    token context (login/logout/verify)
  lib/api.ts           API base, bearer headers, image URLs
  components/          Layout (sidebar + top bar), ProtectedRoute
  pages/               Login, Dashboard, Items, AddItem, Reports
  index.css            Tailwind + shared .card/.btn/.table utility classes
```

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
