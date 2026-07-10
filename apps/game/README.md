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
  AdSense on web (bottom banner on home, 160x600 side rails on wide swipe
  screens); a settings switch (`cdgodd.ads_enabled`) turns everything off.
  Never blocks gameplay.
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
pnpm build:web                   # expo export --platform web → dist/
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
