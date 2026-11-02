import { expect, test } from '@playwright/test';

/**
 * What the Worker answers (wrangler.toml, public/_redirects), so CI only: that's
 * where the static export runs behind wrangler, the expo dev server routes on
 * its own.
 */
test.describe('worker routing', () => {
  test.skip(!process.env.CI, 'needs the static export behind wrangler');
  test.use({ locale: 'fr-FR' });

  test('an unknown URL is a real 404 that leads back to the game', async ({
    page,
  }) => {
    const response = await page.goto('/does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Page introuvable' }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: 'Voir tous les items' }).click();
    await page.waitForURL(/\/items$/);
  });

  test('an unknown item is a real 404 and says so', async ({ page }) => {
    const response = await page.goto('/item/999999-nope');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Item introuvable')).toBeVisible({
      timeout: 30_000,
    });
  });

  test('a room link opens the room, out of search results', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const alice = await (await browser.newContext()).newPage();
    await alice.goto('/multiplayer');
    await alice.getByTestId('nickname-input').fill('Alice');
    await alice.getByTestId('create-room').click();
    await alice.waitForURL(/\/room\/[A-HJ-NP-Z2-9]{6}/, { timeout: 30_000 });
    const code = /\/room\/([A-HJ-NP-Z2-9]{6})/.exec(alice.url())![1]!;

    const bob = await (await browser.newContext()).newPage();
    const response = await bob.goto(`/room/${code}?name=Bob`);
    expect(response?.status()).toBe(200);
    await expect(bob.getByText('Alice')).toBeVisible({ timeout: 30_000 });
    await expect(alice.getByText('Bob')).toBeVisible({ timeout: 15_000 });
    await expect(bob.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex',
    );
  });

  test('the join form stays reachable on a small screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/multiplayer');
    await page.getByTestId('join-room').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('join-room')).toBeInViewport();
  });
});
