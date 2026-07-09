import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { api } from './helpers';

interface Card {
  id: number;
  label: string;
  categoryKeys: string[];
  imageUrl: string | null;
  votesLeft: number;
  votesRight: number;
}

async function deck(query = ''): Promise<{ cards: Card[]; nextCursor?: number }> {
  const res = await api(`/deck${query}`);
  expect(res.status).toBe(200);
  return (await res.json()) as { cards: Card[]; nextCursor?: number };
}

describe('GET /deck', () => {
  it('returns all six seeded approved cards with shaped fields', async () => {
    const body = await deck();
    expect(body.cards).toHaveLength(6);
    expect(body.nextCursor).toBeUndefined(); // 6 < default limit 25

    const quinoa = body.cards.find((c) => c.id === 1)!;
    expect(quinoa.label).toBe('Le quinoa');
    expect(quinoa.imageUrl).toBeNull(); // seed has no images
    expect(quinoa.categoryKeys).toEqual(['food']);

    // Item 5 is multi-category (daily-life + culture); order unspecified.
    const velo = body.cards.find((c) => c.id === 5)!;
    expect([...velo.categoryKeys].sort()).toEqual(['culture', 'daily-life']);
  });

  it('paginates with cursor/limit', async () => {
    const page1 = await deck('?limit=2');
    expect(page1.cards.map((c) => c.id)).toEqual([1, 2]);
    expect(page1.nextCursor).toBe(2);

    const page2 = await deck(`?limit=2&cursor=${page1.nextCursor}`);
    expect(page2.cards.map((c) => c.id)).toEqual([3, 4]);

    const page3 = await deck('?limit=2&cursor=4');
    expect(page3.cards.map((c) => c.id)).toEqual([5, 6]);
    // Full page — nextCursor present even though it is the last page.
    expect(page3.nextCursor).toBe(6);
    const page4 = await deck('?limit=2&cursor=6');
    expect(page4.cards).toEqual([]);
    expect(page4.nextCursor).toBeUndefined();
  });

  it('filters by category (any = union, all = intersection)', async () => {
    expect((await deck('?categories=food')).cards.map((c) => c.id)).toEqual([1, 2]);
    expect((await deck('?categories=culture')).cards.map((c) => c.id)).toEqual([
      3, 4, 5,
    ]);
    expect(
      (await deck('?categories=food,culture')).cards.map((c) => c.id),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(
      (await deck('?categories=culture,daily-life&match=all')).cards.map(
        (c) => c.id,
      ),
    ).toEqual([5]);
    expect((await deck('?categories=does-not-exist')).cards).toEqual([]);
  });

  it('excludes non-approved items', async () => {
    await env.DB.prepare(`UPDATE items SET status = 'pending' WHERE id = 3`).run();
    const body = await deck();
    expect(body.cards.map((c) => c.id)).toEqual([1, 2, 4, 5, 6]);
  });

  it('400s on bad queries', async () => {
    for (const q of ['?limit=0', '?limit=51', '?cursor=-1', '?categories=Bad!']) {
      const res = await api(`/deck${q}`);
      expect(res.status).toBe(400);
    }
  });
});

describe('GET /categories', () => {
  it('returns localized categories sorted by name', async () => {
    const res = await api('/categories?lang=fr');
    expect(await res.json()).toEqual({
      categories: [
        { key: 'culture', name: 'Culture' },
        { key: 'food', name: 'Nourriture' },
        { key: 'daily-life', name: 'Vie quotidienne' },
      ],
    });
  });
});

describe('GET /items/tallies', () => {
  it('returns tallies for requested ids', async () => {
    const res = await api('/items/tallies?ids=1,2');
    const body = (await res.json()) as { tallies: Array<{ itemId: number }> };
    expect(body.tallies.map((t) => t.itemId).sort()).toEqual([1, 2]);
  });

  it('empty or junk ids yield an empty list', async () => {
    for (const q of ['', '?ids=', '?ids=abc,-1,0']) {
      const res = await api(`/items/tallies${q}`);
      expect(await res.json()).toEqual({ tallies: [] });
    }
  });
});

describe('GET /items/search', () => {
  it('finds items by label substring', async () => {
    const res = await api('/items/search?q=quinoa');
    const body = (await res.json()) as { results: Card[] };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]!.id).toBe(1);
  });

  it('400s without q', async () => {
    expect((await api('/items/search')).status).toBe(400);
  });
});
