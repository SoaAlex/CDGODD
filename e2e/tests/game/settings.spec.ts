import { expect, test } from '@playwright/test';

test.describe('settings', () => {
  test('show-results toggle persists across reload', async ({ page }) => {
    await page.goto('/settings');
    const toggle = page.getByTestId('show-results-switch');
    await expect(toggle).toBeVisible({ timeout: 30_000 });

    // react-native-web renders the state on a nested checkbox input.
    const checkbox = toggle.locator('input[type="checkbox"]');
    const before = await checkbox.isChecked();
    await toggle.click();
    await expect(checkbox).toBeChecked({ checked: !before });

    await page.reload();
    await expect(
      page.getByTestId('show-results-switch').locator('input[type="checkbox"]'),
    ).toBeChecked({ checked: !before, timeout: 30_000 });
  });
});
