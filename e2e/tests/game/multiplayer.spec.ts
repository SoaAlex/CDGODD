import { expect, test, type Page } from '@playwright/test';

/** Swipe every card until this player's hand is done (buttons disappear). */
async function voteAllCards(page: Page, side: 'vote-left' | 'vote-right') {
  const button = page.getByTestId(side);
  // Bounded loop: seed yields at most 6 cards. Each click gets a short
  // actionability budget — on slow CI runners a hidden/animating button must
  // end the loop, not wedge the whole test until its timeout.
  for (let i = 0; i < 15; i++) {
    try {
      await button.click({ timeout: 5_000 });
    } catch {
      break; // hand done (button gone) or waiting/results screen
    }
    await page.waitForTimeout(200);
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

    // Batch mode: after the splash, the host paces a card-by-card reveal.
    await expect(alice.getByTestId('next-card')).toBeVisible({
      timeout: 15_000,
    });
    // Both players look at the same first card, with both voters on it.
    await expect(alice.getByText('1 / 6')).toBeVisible();
    await expect(bob.getByText('1 / 6')).toBeVisible({ timeout: 15_000 });
    await expect(alice.getByText('Alice').first()).toBeVisible();
    await expect(alice.getByText('Bob').first()).toBeVisible();

    // Advancing is mirrored on the guest in real time.
    await alice.getByTestId('next-card').click();
    await expect(alice.getByText('2 / 6')).toBeVisible();
    await expect(bob.getByText('2 / 6')).toBeVisible({ timeout: 15_000 });

    // Walk to the end of the reveal; the summary takes over.
    for (let i = 0; i < 10; i++) {
      try {
        await alice.getByTestId('next-card').click({ timeout: 5_000 });
      } catch {
        break; // reveal over — button gone, summary shown
      }
      await alice.waitForTimeout(200);
    }

    // Summary: results with both nicknames, host gets the replay control.
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
