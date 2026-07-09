import { test as base } from '@playwright/test';

export const ADMIN_TOKEN = 'cdgodd-e2e-token';
export const API_URL = 'http://localhost:8789';

/**
 * Admin test with the token pre-seeded. The app keeps it in
 * sessionStorage['admin_token'], which Playwright's storageState does NOT
 * persist — so inject it before every page load. login.spec.ts drives the
 * real login form instead.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((token: string) => {
      sessionStorage.setItem('admin_token', token);
    }, ADMIN_TOKEN);
    await use(page);
  },
});

export { expect } from '@playwright/test';
