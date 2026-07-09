import { expect, test } from '@playwright/test';
import { ADMIN_TOKEN, API_URL } from '../../fixtures/admin';

test.describe('free search', () => {
  test('finds a seeded item and votes on it', async ({ page }) => {
    await page.goto('/search');
    const input = page.getByTestId('search-input');
    await expect(input).toBeVisible({ timeout: 30_000 });

    await input.fill('quinoa');
    await page.getByTestId('result-1').click();
    await page.getByTestId('vote-left').click();
    // Tally appears once the vote lands.
    await expect(page.getByText(/%|vote/i).first()).toBeVisible();
  });

  test('proposes an unknown label as a pending submission', async ({
    page,
    request,
  }) => {
    await page.goto('/search');
    const input = page.getByTestId('search-input');
    await expect(input).toBeVisible({ timeout: 30_000 });

    const label = `La raclette partagée ${Date.now()}`;
    await input.fill(label);
    await page.getByTestId('propose').click();
    await expect(page.getByTestId('submitted')).toBeVisible();

    // Full loop: the submission landed in the admin pending queue.
    const res = await request.get(`${API_URL}/admin/items?status=pending`, {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const { items } = (await res.json()) as {
      items: Array<{ label: string }>;
    };
    expect(items.map((i) => i.label)).toContain(label);
  });
});
