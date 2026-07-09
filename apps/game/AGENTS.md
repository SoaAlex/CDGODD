# apps/game — AGENTS.md

`cdgodd-game` — Expo (React Native) app: web + iOS + Android from one codebase.
The web export is served as an assets-only Worker. See [`README.md`](README.md);
root rules in [`../../AGENTS.md`](../../AGENTS.md) apply.

## Shape

- `src/app/` — expo-router routes (file-based).
- `src/components/`, `src/hooks/`, `src/lib/`, `src/constants/` — the usual.
- `src/ads/` — ad integration (behind consent; ads are the only data collector).
- Data/types from `@cdgodd/shared`; talks to the API worker.

## Conventions

- **Cross-platform first.** Code runs on web *and* native. Prefer React Native
  primitives (`View`, `Text`, `Pressable`) over DOM. Guard web-only or
  native-only code with `Platform.select` / `.web.tsx` / `.native.tsx`.
- This app *does* have real lint: `pnpm --dir apps/game lint` (expo eslint). Run
  it — it's the one app where lint is a signal.
- Keep the anonymous/consent model intact; ads load only after consent.

## Verify

Web is the fastest loop: `pnpm --dir apps/game exec expo start --web`
(port 8081), drive with `preview_*` tools. Typecheck:
`pnpm --dir apps/game typecheck`. Native builds need a device/simulator — call
that out rather than claiming native is verified.
