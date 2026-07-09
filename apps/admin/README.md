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
- **Modération** (`/items`) — all/pending/approved/rejected queue with image
  thumbnails, category and status badges. Quick actions (approve, reject, reset
  to pending) plus a full **edit modal**: replace the image, rename the label,
  toggle categories (an item can have several), override vote counts, and set
  status. The image section includes a **free-license picker** ("Chercher une
  image"): searches Wikimedia Commons + Pixabay via
  `GET /admin/image-candidates`, one click copies the candidate to R2 with its
  attribution (`POST /admin/items/:id/image-from-source`), and a "Générer par
  IA" button generates a Workers AI image (`POST /admin/items/:id/ai-image`).
- **Créer un item** (`/add-item`) — create an item with a French label,
  categories, and drag-and-drop image (uploaded to R2); goes live immediately.
  The same free-license picker is available in **select mode**: the choice
  (candidate or "Générer par IA") is kept locally and applied right after
  `POST /admin/items` returns the new item id. A **"Mode rapide"** checkbox
  keeps you on the page after each create (label/translations/image reset,
  categories kept, label input refocused) for rapid bulk entry; unchecked,
  the page redirects to the items list as before.
- **Catégories** (`/categories`) — create categories (key + French name) and
  add/edit/delete per-language translations.
- **Signalements** (`/reports`) — reported items, most-reported first.

Editing is backed by `PATCH /admin/items/:id` (partial: `label`, `status`,
`votes_left`, `votes_right`, `categoryKeys` — the array replaces the item's
whole category set) and `PATCH /admin/items/:id/image` (multipart image
replace). `GET /admin/items` returns `category_keys` as a CSV of keys, parsed
client-side and resolved to display names via `GET /categories`. The edit modal also manages non-French labels via
`GET/PUT/DELETE /admin/items/:id/translations/:lang` (saved immediately,
independent of the modal's Save button). Each row also has a delete button
(`DELETE /admin/items/:id`, behind a confirm dialog) that permanently removes
the item with its votes, reports and image.

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
  components/          Layout (sidebar + top bar), ProtectedRoute, ItemEditModal,
                       CategoryPicker, ImagePicker
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
