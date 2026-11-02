import { expect, test } from '@playwright/test';

const SEED_LABELS = [
  'Le quinoa',
  'La côte de bœuf',
  'Le théâtre subventionné',
  'La chasse',
  'Le vélo cargo',
  'La résidence secondaire',
];

test.describe('solo swipe game', () => {
  test('deck loads and voting advances the card', async ({ page }) => {
    await page.goto('/solo');

    const voteLeft = page.getByTestId('vote-left');
    await expect(voteLeft).toBeVisible({ timeout: 30_000 });

    // A seeded label is on screen.
    const labelPattern = new RegExp(
      SEED_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    );
    await expect(page.getByText(labelPattern).first()).toBeVisible();
    const before = await page.getByText(labelPattern).first().textContent();

    await voteLeft.click();
    // Card advances to a different seeded label.
    await expect(async () => {
      const after = await page.getByText(labelPattern).first().textContent();
      expect(after).not.toBe(before);
    }).toPass({ timeout: 10_000 });
  });

  test('the category filter leaves out empty categories', async ({ page }) => {
    await page.route('**/categories?*', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.categories.push({ key: 'nsfw', name: 'NSFW', count: 0 });
      await route.fulfill({ response, json: body });
    });
    await page.goto('/solo');
    await page.getByTestId('category-filter-trigger').click();
    await expect(page.getByTestId('category-food')).toBeVisible();
    await expect(page.getByTestId('category-nsfw')).toHaveCount(0);
  });

  test('vote and report controls are present', async ({ page }) => {
    await page.goto('/solo');
    await expect(page.getByTestId('vote-left')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('vote-right')).toBeVisible();
    await expect(page.getByTestId('report')).toBeVisible();
    await expect(page.getByTestId('toggle-results')).toBeVisible();
  });
});
