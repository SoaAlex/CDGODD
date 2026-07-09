# apps/admin — AGENTS.md

`cdgodd-admin-v2` — React + Vite moderation panel, served as an assets-only
Worker. Pure frontend; all data comes from the API. See [`README.md`](README.md);
root rules in [`../../AGENTS.md`](../../AGENTS.md) apply.

## Shape

- `src/pages/` — routed views (react-router). `src/components/`, `src/hooks/`.
- `src/lib/api.ts` — the API client. `API` base = `VITE_API_URL` or `/api` (Vite
  proxy in dev). Every authenticated call uses `authHeaders(token)` (bearer).
- `src/lib/flags.ts` — moderation flag definitions; `key` must match the DB
  column and the API PATCH/POST field. `label` is display-only.
- Tailwind for styling.

## Conventions

- **Go through `src/lib/api.ts`**, don't scatter raw `fetch` calls. Admin
  endpoints require the bearer token; `apiGet`/helpers throw on non-2xx.
- Adding a moderation flag = add to `ITEM_FLAGS` here *and* the matching column +
  API handling in `apps/api`. Keep `key` identical on both sides.
- No login for the game, but admin *is* token-gated — never expose `ADMIN_TOKEN`
  or ship it into game/shared code.

## Verify

`pnpm --dir apps/admin dev` (port 5173, proxies `/api` → 8787; run the API too),
drive with `preview_*`. Typecheck: `pnpm --dir apps/admin typecheck`.

Playwright e2e (`e2e/tests/admin/`, run with `pnpm test:e2e`) covers login and
item moderation. There are no test ids here — specs select by French labels
and roles, so renaming visible text (tabs, buttons, nav) can break them.
