import { expect, test, type Page } from '@playwright/test';

/** Swipe every card until this player's hand is done (buttons disappear). */
async function voteAllCards(page: Page, side: 'vote-left' | 'vote-right') {
  const button = page.getByTestId(side);
  // Bounded loop: rooms cap at 50 cards; seed yields at most 6.
  for (let i = 0; i < 60; i++) {
    if (!(await button.isVisible().catch(() => false))) break;
    await button.click();
    await page.waitForTimeout(150);
  }
}

test.describe('multiplayer room', () => {
  test('two players: create, join, play a round, reveal, restart', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const alice = await ctxA.newPage();
    const bob = await ctxB.newPage();

    // Alice creates the room.
    await alice.goto('/multiplayer');
    await expect(alice.getByTestId('nickname-input')).toBeVisible({
      timeout: 30_000,
    });
    await alice.getByTestId('nickname-input').fill('Alice');
    await alice.getByTestId('create-room').click();
    await alice.waitForURL(/\/room\/[A-HJ-NP-Z2-9]{6}/, { timeout: 30_000 });
    const code = /\/room\/([A-HJ-NP-Z2-9]{6})/.exec(alice.url())![1]!;

    // Lobby: code shown, copy-link present, Alice is in.
    await expect(alice.getByText(code)).toBeVisible();
    await expect(alice.getByTestId('copy-link')).toBeVisible();

    // Bob joins by code.
    await bob.goto('/multiplayer');
    await expect(bob.getByTestId('nickname-input')).toBeVisible({
      timeout: 30_000,
    });
    await bob.getByTestId('nickname-input').fill('Bob');
    await bob.getByTestId('join-code').fill(code);
    await bob.getByTestId('join-room').click();
    await bob.waitForURL(new RegExp(`/room/${code}`), { timeout: 30_000 });

    // Both see two players in the lobby.
    await expect(alice.getByText('Bob')).toBeVisible({ timeout: 15_000 });
    await expect(bob.getByText('Alice')).toBeVisible({ timeout: 15_000 });

    // Only the host has the start control.
    await expect(alice.getByTestId('start-round')).toBeVisible();
    await expect(bob.getByTestId('start-round')).toHaveCount(0);

    // Play the round: everyone swipes their whole hand.
    await alice.getByTestId('start-round').click();
    await expect(alice.getByTestId('vote-left')).toBeVisible({
      timeout: 15_000,
    });
    await expect(bob.getByTestId('vote-left')).toBeVisible({ timeout: 15_000 });
    await voteAllCards(alice, 'vote-left');
    await voteAllCards(bob, 'vote-right');

    // Reveal: results with both nicknames, host gets the replay control.
    await expect(alice.getByTestId('replay-settings')).toBeVisible({
      timeout: 15_000,
    });
    await expect(alice.getByText('Alice').first()).toBeVisible();
    await expect(alice.getByText('Bob').first()).toBeVisible();

    // Restart deals a fresh round to everyone.
    await alice.getByTestId('replay-settings').click();
    await alice.getByTestId('restart-round').click();
    await expect(alice.getByTestId('vote-left')).toBeVisible({
      timeout: 15_000,
    });
    await expect(bob.getByTestId('vote-left')).toBeVisible({ timeout: 15_000 });

    await ctxA.close();
    await ctxB.close();
  });
});
