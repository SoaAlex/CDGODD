import { defineConfig } from '@playwright/test';

const CI = !!process.env.CI;

/**
 * Three servers, dedicated ports (no clash with dev 8787/5173/8081 or the
 * verify pair 8788/5176):
 *   - API    :8789  wrangler dev --local, fresh migrated+seeded D1 in an
 *                   isolated persist dir — never any prod data.
 *   - Admin  :5178  vite, pointed at the local API.
 *   - Game   :8082  expo web dev server locally; in CI the static export
 *                   (apps/game/dist, built by the workflow) served instead.
 *
 * Turnstile is fully bypassed: no TURNSTILE_SECRET on the API, no
 * EXPO_PUBLIC_TURNSTILE_SITEKEY in the game → the game sends a 'dev' token
 * and the API accepts it.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: CI ? 1 : 0,
  // Single shared local API + D1 — serialize to avoid cross-test data races.
  workers: 1,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8082',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'admin',
      testDir: './tests/admin',
      use: { baseURL: 'http://localhost:5178' },
    },
    {
      name: 'game',
      testDir: './tests/game',
    },
  ],
  webServer: [
    {
      command: 'pnpm --dir ../apps/api e2e:server',
      url: 'http://localhost:8789/',
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --dir ../apps/admin exec vite --port 5178',
      env: { VITE_API_URL: 'http://localhost:8789' },
      url: 'http://localhost:5178',
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: CI
        ? 'pnpm exec serve --no-clipboard --single -l 8082 ../apps/game/dist'
        : 'pnpm --dir ../apps/game exec expo start --web --port 8082',
      env: { EXPO_PUBLIC_API_URL: 'http://localhost:8789' },
      url: 'http://localhost:8082',
      reuseExistingServer: !CI,
      timeout: 300_000, // expo's first web bundle is slow
    },
  ],
});
