# `cdgodd-game`

The game client — Expo (React Native), one codebase for **web, iOS, and
Android**. The web export is served as an assets-only Cloudflare Worker.

- **Production (web):** https://cestdegaucheoudedroite.com
- **Config:** [`app.json`](app.json), [`wrangler.toml`](wrangler.toml)

## Features

- **Solo** — swipe cards (Reanimated gestures) or use the ← / → arrow keys on
  web / Gauche–Droite buttons. Deck is batch-fetched with the next few card
  images prefetched. Global results are hidden by default; a toggle shows the
  previous card's result and, when on, the live tally of the current card.
  Cards with a free-license image show a small ⓘ badge — tap for the credit
  strip (author · license, links to the source page); AI-generated images get
  a static "IA" badge (driven by `DeckCard.imageAttribution`). A category
  dropdown at the top filters the deck (modal multi-select; "Toutes" resets).
  Swiped cards are remembered on-device only (`lib/seen.ts`, AsyncStorage —
  no server tracking) and filtered out of future decks; once everything is
  seen, a "Tu as tout vu !" screen offers a replay that clears the set.
- **Free search** — find an item and vote on it, or propose a new one (moderated).
- **Multiplayer** — create/join a room by 6-char code; everyone gets the same
  deck and swipes it at their own pace. The host picks the mode, the number of
  cards (5–50 stepper) and the categories to deal from — both at creation and
  on replay. Batch mode reveals all results at the end; live mode returns each
  voter their card's running tally. Rooms are Durable Objects on the API.
- **History** — device-local record of your votes with fresh global tallies.
- **Anonymous** — a resettable device `session_id`, no account. Only ads collect
  data, behind a consent flow.
- **Ads** — AdMob on native (UMP consent, top banners + interstitial), optional
  AdSense on web (160x600 side rails on wide swipe screens; the home-page
  banner is intentionally removed while the site is under AdSense review — a
  menu screen counts as "no publisher content"); a settings switch
  (`cdgodd.ads_enabled`) turns everything off. Never blocks gameplay.
  Web consent is Google's CMP: the GDPR message published in AdSense
  "Privacy & messaging" is served by the global adsbygoogle tag in
  `src/app/+html.tsx` (which must stay on every page for it to display).
- **SEO / crawlable pages** — the web export is fully static (one prerendered
  HTML file per route, French at build time). Content pages: `/privacy`
  (GDPR/AdSense privacy policy), `/a-propos` (concept, methodology, FAQ),
  `/classements` (top-20 rankings), `/items` (browse index grouped by
  category), one `/categorie/<key>` page per category (ranked item list) and
  one `/item/<id>-<slug>` page per approved item (vote stats, category +
  overall rank, neighbour links). All are generated from a build-time
  snapshot of the catalog (`scripts/generate-item-manifest.mjs` →
  `src/generated/item-manifest.json`, committed as an empty placeholder).
  Indexing hygiene: the manifest fetches the deck with `exclude=nsfw`,
  drops a small sensitive-label blocklist (backstop for items missing the
  nsfw tag) and drops labels < 3 chars, so sensitive/junk items never get
  an indexed, ad-tagged page; `/settings` and `/history` carry a noindex
  meta;
  `scripts/generate-sitemap.mjs` rewrites `dist/sitemap.xml` with the
  content pages only (no lobby/utility screens). Vote percentages on item
  pages hydrate live from `/items/tallies`.
- **Fonts & music** — ClashGrotesk / MonteiroLobato from `assets/`; the theme
  song loops on web only.

## Platform-split modules

Web vs native behaviour is handled with Metro's `.web.ts(x)` resolution, not
runtime branches:

- `src/ads/` — AdMob/UMP on native, AdSense/no-op on web.
- `src/lib/music.*` — plays on web, no-op on native.
- `src/lib/turnstile.*` — invisible widget on web, placeholder on native.

## Config

- `EXPO_PUBLIC_API_URL` — API base (default `http://localhost:8787`; CI sets the
  production URL). See [`.env.example`](.env.example) for all `EXPO_PUBLIC_*`
  vars (AdMob unit ids, AdSense client/slot, Turnstile sitekey).

## Run & deploy

```bash
pnpm exec expo start --web       # dev on :8081 (also --ios / --android)
pnpm typecheck
pnpm build:web                   # item manifest + expo export → dist/ + sitemap
                                 # (manifest fetch fails soft: no API reachable
                                 #  → empty manifest, no item pages)
pnpm deploy                      # build:web + wrangler deploy → cestdegaucheoudedroite.com
```

Native builds (App Store / Play Store) go through EAS Build — not part of the
web CI pipeline. Profiles in [`eas.json`](eas.json):

```bash
npx eas-cli login                      # once (Expo account)
npx eas-cli init                       # once — writes extra.eas.projectId to app.json
npx eas-cli build -p android --profile preview     # installable APK, TEST ads
npx eas-cli build -p ios --profile preview         # internal iOS build, TEST ads
npx eas-cli build -p all --profile production      # store builds, REAL AdMob ads
npx eas-cli submit -p android|ios                  # upload to store
```

`development` = dev client, `preview` = release build with Google test ads
(`EXPO_PUBLIC_FORCE_TEST_ADS=1`), `production` = real per-platform AdMob unit
ids (hardcoded in `src/ads/`, gated behind `__DEV__`/the force flag). Bundle
id / package: `com.cdgodd.app` — changeable until the first store upload,
permanent after.
