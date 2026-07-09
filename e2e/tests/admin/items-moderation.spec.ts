import { ADMIN_TOKEN, API_URL, expect, test } from '../../fixtures/admin';

test.describe('items moderation', () => {
  test('lists the seeded items', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('button', { name: 'Approuvés' }).click();
    for (const label of ['Le quinoa', 'La chasse', 'Le vélo cargo']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('flips an item status and finds it under the matching tab', async ({
    page,
  }) => {
    await page.goto('/items');
    await page.getByRole('button', { name: 'Approuvés' }).click();
    const row = page.locator('tr', { hasText: 'La chasse' });
    await expect(row).toBeVisible();

    await row.locator('select').selectOption('rejected');
    // Row leaves the approved tab once its status no longer matches.
    await expect(row).toHaveCount(0);

    await page.getByRole('button', { name: 'Rejetés' }).click();
    await expect(page.locator('tr', { hasText: 'La chasse' })).toBeVisible();

    // Restore for the other specs (single worker → deterministic order).
    await page
      .locator('tr', { hasText: 'La chasse' })
      .locator('select')
      .selectOption('approved');
  });

  test('inline-edits a label and persists it', async ({ page, request }) => {
    await page.goto('/items');
    await page.getByRole('button', { name: 'Approuvés' }).click();

    await page.getByRole('button', { name: 'La résidence secondaire' }).click();
    const input = page.locator('input.w-40');
    await input.fill('La résidence tertiaire');
    await input.press('Enter');
    await expect(
      page.getByRole('button', { name: 'La résidence tertiaire' }),
    ).toBeVisible();

    // Persisted server-side, not just optimistic UI.
    const res = await request.get(`${API_URL}/admin/items?status=approved`, {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const { items } = (await res.json()) as {
      items: Array<{ label: string }>;
    };
    expect(items.map((i) => i.label)).toContain('La résidence tertiaire');

    // Restore the label.
    await page.getByRole('button', { name: 'La résidence tertiaire' }).click();
    await input.fill('La résidence secondaire');
    await input.press('Enter');
    await expect(
      page.getByRole('button', { name: 'La résidence secondaire' }),
    ).toBeVisible();
  });
});
