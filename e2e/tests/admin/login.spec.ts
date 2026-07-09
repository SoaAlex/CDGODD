import { expect, test } from '@playwright/test';
import { ADMIN_TOKEN } from '../../fixtures/admin';

test.describe('admin login', () => {
  test('rejects a wrong token', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#token', 'wrong-token');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    // Probe of /admin/stats 401s → error shown, still on /login.
    await expect(page.locator('.bg-red-100')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('accepts the right token and lands on the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#token', ADMIN_TOKEN);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('redirects unauthenticated visits to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});
