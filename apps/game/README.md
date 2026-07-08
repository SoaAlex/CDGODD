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
- **Free search** — find an item and vote on it, or propose a new one (moderated).
- **Multiplayer** — create/join a room by 6-char code; everyone gets the same
  deck and swipes it at their own pace. Batch mode reveals all results at the
  end; live mode returns each voter their card's running tally. Rooms are
  Durable Objects on the API.
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
web CI pipeline.
