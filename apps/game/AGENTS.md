# apps/game — AGENTS.md

`cdgodd-game` — Expo (React Native) app: web + iOS + Android from one codebase.
The web export is served as an assets-only Worker. See [`README.md`](README.md);
root rules in [`../../AGENTS.md`](../../AGENTS.md) apply.

## Shape

- `src/app/` — expo-router routes (file-based).
- `src/components/`, `src/hooks/`, `src/lib/`, `src/constants/` — the usual.
- `src/ads/` — ad integration (behind consent; ads are the only data collector).
- `src/generated/item-manifest.json` — build-time catalog snapshot
  (`{generatedAt, categories, items}`) written by
  `scripts/generate-item-manifest.mjs` (part of `build:web`); the committed
  file is an empty placeholder — don't hand-edit, don't commit a populated
  one. It feeds the prerendered `/item/[id]`, `/items`, `/categorie/[key]`
  and `/classements` SEO pages plus `scripts/generate-sitemap.mjs`. The
  script excludes the `nsfw` category, a small sensitive-label blocklist
  (backstop for items missing the nsfw tag) and labels < 3 chars — keep it
  that way (ad-tagged pages on adult content are an AdSense violation).
- Data/types from `@cdgodd/shared`; talks to the API worker.

## Conventions

- **Cross-platform first.** Code runs on web *and* native. Prefer React Native
  primitives (`View`, `Text`, `Pressable`) over DOM. Guard web-only or
  native-only code with `Platform.select` / `.web.tsx` / `.native.tsx`.
- This app *does* have real lint: `pnpm --dir apps/game lint` (expo eslint). Run
  it — it's the one app where lint is a signal.
- Keep the anonymous/consent model intact; ads load only after consent.
- **AdSense compliance:** no ad slots on screens without real content (menus,
  lobbies, legal pages). The web home banner was removed for the AdSense
  review — don't re-add it without checking the account is approved.
- **Crawlability:** the static export is the SEO surface. Internal navigation
  that should be crawlable uses `expo-router` `<Link>` (real `<a href>`), not
  `router.push`. With `asChild`, pass a single flattened style object —
  function styles get dropped and array styles break the DOM.

## Verify

Web is the fastest loop: `pnpm --dir apps/game exec expo start --web`
(port 8081), drive with `preview_*` tools. Typecheck:
`pnpm --dir apps/game typecheck`. Native builds need a device/simulator — call
that out rather than claiming native is verified.

Playwright e2e (`e2e/tests/game/`, run with `pnpm test:e2e`) covers solo,
search, multiplayer and settings via the `testID`s → `data-testid` on web.
Keep existing `testID`s stable; add one when building a new interactive
element an e2e spec will need.
