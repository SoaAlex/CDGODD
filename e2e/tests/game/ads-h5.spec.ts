import { expect, test, type Page } from '@playwright/test';

/**
 * Google H5 Games Ads wiring, against a stand-in for adsbygoogle.js: e2e never
 * reaches Google (the host is unresolvable, see playwright.config.ts), and the
 * real script only serves ads on an approved domain anyway. It records what the
 * game asks for and, like the real one, calls beforeAd/afterAd/adBreakDone. It
 * also stands in for Google's CMP.
 */
const FAKE_ADSBYGOOGLE = `
(() => {
  const ads = (window.__ads = {
    breaks: [],
    configs: [],
    fill: window.__adsFill !== false,
    finish: null,
    revocations: 0,
  });
  const handle = (o) => {
    if (!o.type) {
      ads.configs.push(o);
      return;
    }
    ads.breaks.push(o.name);
    if (!ads.fill) {
      o.adBreakDone({ breakName: o.name, breakStatus: 'frequencyCapped' });
      return;
    }
    o.beforeAd();
    ads.finish = () => {
      ads.finish = null;
      o.afterAd();
      o.adBreakDone({ breakName: o.name, breakStatus: 'viewed' });
    };
  };
  const queued = window.adsbygoogle;
  window.adsbygoogle = { push: handle };
  queued.forEach(handle);

  window.__tcfapi = (command, _version, callback) => {
    if (command === 'addEventListener') {
      callback({ gdprApplies: true, listenerId: 1 }, true);
    }
  };
  const fc = (window.googlefc = window.googlefc || {});
  fc.showRevocationMessage = () => {
    ads.revocations += 1;
  };
  const run = (entry) => entry.CONSENT_API_READY && entry.CONSENT_API_READY();
  (fc.callbackQueue || []).forEach(run);
  fc.callbackQueue = { push: run };
})();
`;

async function installFakeGoogle(page: Page) {
  await page.route('https://pagead2.googlesyndication.com/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: FAKE_ADSBYGOOGLE,
    }),
  );
}

/** A deck endpoint serving these cards once, so the deck can be sized at will. */
async function stubDeck(page: Page, categoryKeys: (index: number) => string[]) {
  const cards = Array.from({ length: 30 }, (_, i) => ({
    id: 1000 + i,
    label: `Carte ${i + 1}`,
    categoryKeys: categoryKeys(i),
    imageUrl: null,
    votesLeft: 0,
    votesRight: 0,
  }));
  await page.route('**/deck?*', (route) => route.fulfill({ json: { cards } }));
  await page.route('**/items/*/vote', (route) =>
    route.fulfill({
      json: { tally: { itemId: 1000, votesLeft: 1, votesRight: 0 } },
    }),
  );
}

const adBreaks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ads: { breaks: string[] } }).__ads.breaks);

test.describe('H5 Games Ads', () => {
  test('entering the game requests a start break, which pauses the game until it ends', async ({
    page,
  }) => {
    await installFakeGoogle(page);
    await stubDeck(page, () => []);
    await page.addInitScript(() => {
      const w = window as unknown as { __audioCalls: string[] };
      w.__audioCalls = [];
      for (const method of ['pause', 'play'] as const) {
        const original = HTMLMediaElement.prototype[method];
        HTMLMediaElement.prototype[method] = function (this: HTMLMediaElement) {
          w.__audioCalls.push(method);
          return original.call(this) as never;
        } as never;
      }
    });

    let votes = 0;
    page.on('request', (request) => {
      if (/\/items\/\d+\/vote/.test(request.url())) votes += 1;
    });

    await page.goto('/solo');
    await expect(page.getByTestId('vote-left')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => adBreaks(page)).toEqual(['solo-start']);

    // Ad up: the keyboard must not vote behind it.
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(800);
    expect(votes).toBe(0);

    // The music was paused for the ad, without rewriting the saved preference.
    expect(
      await page.evaluate(() => (window as unknown as { __audioCalls: string[] }).__audioCalls),
    ).toContain('pause');
    expect(
      await page.evaluate(() => localStorage.getItem('cdgodd.music_muted')),
    ).toBeNull();

    // Ad over: the music comes back and the keyboard votes again.
    await page.evaluate(() => {
      (window as unknown as { __audioCalls: string[] }).__audioCalls.length = 0;
      (window as unknown as { __ads: { finish: () => void } }).__ads.finish();
    });
    expect(
      await page.evaluate(() => (window as unknown as { __audioCalls: string[] }).__audioCalls),
    ).toContain('play');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => votes).toBe(1);
  });

  test('swiping requests a next break every 20 cards', async ({ page }) => {
    await installFakeGoogle(page);
    await stubDeck(page, () => []);
    // Nothing fills, so play is never interrupted (e.g. frequency capped).
    await page.addInitScript(() => {
      (window as unknown as { __adsFill: boolean }).__adsFill = false;
    });

    await page.goto('/solo');
    await expect(page.getByTestId('vote-left')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => adBreaks(page)).toEqual(['solo-start']);

    // One vote request per swipe. The deck ignores clicks during the exit
    // animation, and the next card already shows behind the top one, so the
    // vote is the only reliable sign that a swipe went through.
    const swipe = () =>
      Promise.all([
        page.waitForRequest('**/items/*/vote'),
        page.getByTestId('vote-left').click(),
      ]);

    for (let i = 1; i <= 19; i++) await swipe();
    expect(await adBreaks(page)).toEqual(['solo-start']);

    await swipe();
    await expect.poll(() => adBreaks(page)).toEqual(['solo-start', 'solo-swipes']);
  });

  test('no break while NSFW cards are in the deck', async ({ page }) => {
    await installFakeGoogle(page);
    await stubDeck(page, (i) => (i === 3 ? ['nsfw'] : []));

    await page.goto('/solo');
    await expect(page.getByTestId('vote-left')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    expect(await adBreaks(page)).toEqual([]);
  });

  test('the settings switch turns everything off', async ({ page }) => {
    await installFakeGoogle(page);
    await stubDeck(page, () => []);
    await page.addInitScript(() => {
      localStorage.setItem('cdgodd.ads_enabled', '0');
    });

    await page.goto('/solo');
    await expect(page.getByTestId('vote-left')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    const seen = await page.evaluate(() => {
      const ads = (window as unknown as { __ads: { breaks: string[]; configs: unknown[] } }).__ads;
      return { breaks: ads.breaks, preloaded: ads.configs.length > 0 };
    });
    expect(seen).toEqual({ breaks: [], preloaded: false });
  });

  test('ads are preloaded from the first page, with the sound state', async ({
    page,
  }) => {
    await installFakeGoogle(page);
    await page.goto('/');
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __ads: { configs: unknown[] } }).__ads.configs),
      )
      .toContainEqual({ preloadAdBreaks: 'on', sound: 'on' });
    // No break outside the game.
    expect(await adBreaks(page)).toEqual([]);
  });

  test('settings reopen the consent message, and our own banner is gone', async ({
    page,
  }) => {
    await installFakeGoogle(page);
    await page.goto('/settings');
    await page.getByTestId('cookie-choices').click({ timeout: 30_000 });
    expect(
      await page.evaluate(() => (window as unknown as { __ads: { revocations: number } }).__ads.revocations),
    ).toBe(1);
    await expect(page.getByTestId('consent-banner')).toHaveCount(0);
    await expect(page.getByTestId('ad-consent-switch')).toHaveCount(0);
  });

  test('an ad blocker changes nothing: the game plays on', async ({ page }) => {
    await page.route('https://pagead2.googlesyndication.com/**', (route) =>
      route.abort(),
    );
    await page.goto('/solo');
    await expect(page.getByTestId('vote-left')).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('ArrowLeft');
    await page.getByTestId('vote-left').click();
    await expect(page.getByTestId('report')).toBeVisible();
  });

  test('a multiplayer round ends with one break, on the results summary', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await installFakeGoogle(page);
    await page.addInitScript(() => {
      (window as unknown as { __adsFill: boolean }).__adsFill = false;
    });

    await page.goto('/multiplayer');
    await page.getByTestId('nickname-input').fill('Alice');
    await page.getByTestId('create-room').click();
    await page.waitForURL(/\/room\//, { timeout: 30_000 });
    await page.getByTestId('start-round').click();
    await expect(page.getByTestId('vote-left')).toBeVisible({ timeout: 15_000 });

    // No break mid-round: the hand and the reveal play out uninterrupted.
    for (let i = 0; i < 15; i++) {
      try {
        await page.getByTestId('vote-left').click({ timeout: 5_000 });
      } catch {
        break; // hand done
      }
      await page.waitForTimeout(200);
    }
    await expect(page.getByTestId('next-card')).toBeVisible({ timeout: 15_000 });
    expect(await adBreaks(page)).toEqual([]);

    for (let i = 0; i < 10; i++) {
      try {
        await page.getByTestId('next-card').click({ timeout: 5_000 });
      } catch {
        break; // reveal over
      }
      await page.waitForTimeout(200);
    }
    await expect(page.getByTestId('replay-settings')).toBeVisible({
      timeout: 15_000,
    });
    await expect.poll(() => adBreaks(page)).toEqual(['room-results']);
  });
});
