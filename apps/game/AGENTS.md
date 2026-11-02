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
- Keep the anonymous/consent model intact: nothing but Google's own tag (which
  carries its CMP) runs ad code before consent, and refusing must stay exactly
  as easy as accepting (CNIL).
- **Web ads are one network per build** (`src/ads/network.ts`), never two on a
  page, or `none` while an AdSense review is under way. Don't delete the
  fallback: it is the rollback. The privacy policy and FAQ describe the network
  in use, so a new network or mode needs its own copy.
- **H5 Games Ads (default):** ads are `adBreak()` calls at natural pauses only,
  and only on game screens (solo, room): never mid-round or on menus, lobbies or
  legal pages. Anything that shows Google ads must stay off NSFW cards and custom
  words (`mayShowNsfw`, `isNsfwCard`): an AdSense violation risks the account.
  Don't wait on an ad break: with an ad blocker or no fill the callbacks may
  never fire. Don't add `<ins>` units: this approval covers H5 only. Consent is
  Google's CMP, not `useAdConsent`.
- **Adsterra (fallback):** banner units only — never enable popunder, social bar,
  push or direct-link formats. Nothing ad-related may load before the visitor
  accepts the consent banner (`useAdConsent() === 'granted'`). Keep slots off
  menus without content, lobbies and legal pages.
- **Crawlability:** the static export is the SEO surface. Internal navigation
  that should be crawlable uses `expo-router` `<Link>` (real `<a href>`), not
  `router.push`. With `asChild`, pass a single flattened style object —
  function styles get dropped and array styles break the DOM.
- **Page outline:** a screen gets one `<ThemedText heading={1}>` and sections
  `heading={2}`. They render `<h1>`-`<h3>` on web, which is what crawlers read.
- **Worker routing:** a new dynamic route with no prerendered pages needs a
  rewrite in `public/_redirects`, or direct visits answer 404. See
  `scripts/finish-web-export.mjs` for files with brackets in their name. Check
  routing with `wrangler dev` on a `build:web` output, not `expo start`.

## Verify

Web is the fastest loop: `pnpm --dir apps/game exec expo start --web`
(port 8081), drive with `preview_*` tools. Typecheck:
`pnpm --dir apps/game typecheck`. Native builds need a device/simulator — call
that out rather than claiming native is verified.

Playwright e2e (`e2e/tests/game/`, run with `pnpm test:e2e`) covers solo,
search, multiplayer and settings via the `testID`s → `data-testid` on web.
Keep existing `testID`s stable; add one when building a new interactive
element an e2e spec will need.
