import { describe, expect, it } from 'vitest';
import {
  castVoteSchema,
  categoryKeySchema,
  categoryMatchSchema,
  createRoomSchema,
  deckQuerySchema,
  langSchema,
  reportItemSchema,
  roomCodeSchema,
  searchQuerySchema,
  sessionIdSchema,
  sideSchema,
  submitItemSchema,
} from './schemas';

describe('sideSchema', () => {
  it('accepts left/right, rejects anything else', () => {
    expect(sideSchema.parse('left')).toBe('left');
    expect(sideSchema.parse('right')).toBe('right');
    expect(sideSchema.safeParse('center').success).toBe(false);
  });
});

describe('langSchema', () => {
  it('accepts ISO 639-1 lowercase pairs only', () => {
    expect(langSchema.parse('fr')).toBe('fr');
    expect(langSchema.safeParse('FR').success).toBe(false);
    expect(langSchema.safeParse('fra').success).toBe(false);
    expect(langSchema.safeParse('f').success).toBe(false);
  });
});

describe('sessionIdSchema', () => {
  it('accepts a UUID, rejects junk', () => {
    expect(
      sessionIdSchema.safeParse('7f9c24e5-2a30-4c2f-9c1d-8b1a2c3d4e5f').success,
    ).toBe(true);
    expect(sessionIdSchema.safeParse('abc').success).toBe(false);
    expect(sessionIdSchema.safeParse('').success).toBe(false);
  });
});

describe('categoryKeySchema', () => {
  it('accepts lowercase slugs up to 50 chars', () => {
    expect(categoryKeySchema.parse('food')).toBe('food');
    expect(categoryKeySchema.parse('daily-life')).toBe('daily-life');
    expect(categoryKeySchema.safeParse('Food').success).toBe(false);
    expect(categoryKeySchema.safeParse('a!b').success).toBe(false);
    expect(categoryKeySchema.safeParse('').success).toBe(false);
    expect(categoryKeySchema.safeParse('a'.repeat(51)).success).toBe(false);
  });
});

describe('categoryMatchSchema', () => {
  it('accepts any/all only', () => {
    expect(categoryMatchSchema.parse('any')).toBe('any');
    expect(categoryMatchSchema.parse('all')).toBe('all');
    expect(categoryMatchSchema.safeParse('some').success).toBe(false);
  });
});

describe('castVoteSchema', () => {
  it('requires a side and a non-empty token', () => {
    expect(
      castVoteSchema.parse({ side: 'left', turnstileToken: 'dev' }),
    ).toEqual({ side: 'left', turnstileToken: 'dev' });
    expect(castVoteSchema.safeParse({ side: 'up', turnstileToken: 'dev' }).success).toBe(false);
    expect(castVoteSchema.safeParse({ side: 'left', turnstileToken: '' }).success).toBe(false);
    expect(castVoteSchema.safeParse({ turnstileToken: 'dev' }).success).toBe(false);
  });
});

describe('deckQuerySchema', () => {
  it('applies defaults', () => {
    expect(deckQuerySchema.parse({})).toEqual({
      lang: 'fr',
      limit: 25,
      match: 'any',
    });
  });

  it('coerces cursor and limit from query strings', () => {
    const parsed = deckQuerySchema.parse({ cursor: '10', limit: '50' });
    expect(parsed.cursor).toBe(10);
    expect(parsed.limit).toBe(50);
  });

  it('enforces bounds', () => {
    expect(deckQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(deckQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(deckQuerySchema.safeParse({ cursor: -1 }).success).toBe(false);
    expect(deckQuerySchema.safeParse({ cursor: 1.5 }).success).toBe(false);
  });

  it('splits categories CSV and filters empties', () => {
    expect(deckQuerySchema.parse({ categories: 'food,culture' }).categories).toEqual([
      'food',
      'culture',
    ]);
    expect(deckQuerySchema.parse({ categories: 'food,,' }).categories).toEqual(['food']);
    expect(deckQuerySchema.parse({ categories: '' }).categories).toEqual([]);
  });

  it('splits exclude CSV like categories, rejects bad keys', () => {
    expect(deckQuerySchema.parse({ exclude: 'food,culture' }).exclude).toEqual([
      'food',
      'culture',
    ]);
    expect(deckQuerySchema.parse({}).exclude).toBeUndefined();
    expect(deckQuerySchema.safeParse({ exclude: 'Bad!' }).success).toBe(false);
  });

  it('rejects bad category keys, too many keys, bad lang and match', () => {
    expect(deckQuerySchema.safeParse({ categories: 'Food' }).success).toBe(false);
    const tooMany = Array.from({ length: 21 }, (_, i) => `c${i}`).join(',');
    expect(deckQuerySchema.safeParse({ categories: tooMany }).success).toBe(false);
    expect(deckQuerySchema.safeParse({ lang: 'FR' }).success).toBe(false);
    expect(deckQuerySchema.safeParse({ match: 'some' }).success).toBe(false);
  });
});

describe('searchQuerySchema', () => {
  it('trims q and bounds its length', () => {
    expect(searchQuerySchema.parse({ q: ' quinoa ' })).toEqual({ q: 'quinoa', lang: 'fr' });
    expect(searchQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: 'a'.repeat(101) }).success).toBe(false);
    expect(searchQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe('submitItemSchema', () => {
  it('trims label, defaults lang, bounds categoryKeys', () => {
    expect(
      submitItemSchema.parse({ label: '  Le pastis  ', turnstileToken: 'dev' }),
    ).toEqual({ label: 'Le pastis', lang: 'fr', turnstileToken: 'dev' });
    expect(submitItemSchema.safeParse({ label: '', turnstileToken: 'dev' }).success).toBe(false);
    expect(
      submitItemSchema.safeParse({ label: 'a'.repeat(81), turnstileToken: 'dev' }).success,
    ).toBe(false);
    expect(
      submitItemSchema.safeParse({
        label: 'ok',
        turnstileToken: 'dev',
        categoryKeys: Array.from({ length: 11 }, () => 'x'),
      }).success,
    ).toBe(false);
  });
});

describe('reportItemSchema', () => {
  it('reason optional and capped at 500', () => {
    expect(reportItemSchema.parse({ turnstileToken: 'dev' })).toEqual({ turnstileToken: 'dev' });
    expect(
      reportItemSchema.safeParse({ reason: 'a'.repeat(501), turnstileToken: 'dev' }).success,
    ).toBe(false);
    expect(reportItemSchema.safeParse({}).success).toBe(false);
  });
});

describe('createRoomSchema', () => {
  it('applies defaults', () => {
    expect(createRoomSchema.parse({})).toEqual({
      mode: 'batch',
      roundSize: 10,
      categoryKeys: [],
      categoryMatch: 'any',
    });
  });

  it('coerces roundSize and enforces 5-50', () => {
    expect(createRoomSchema.parse({ roundSize: '15' }).roundSize).toBe(15);
    expect(createRoomSchema.safeParse({ roundSize: 4 }).success).toBe(false);
    expect(createRoomSchema.safeParse({ roundSize: 51 }).success).toBe(false);
  });

  it('validates mode and categoryKeys', () => {
    expect(createRoomSchema.parse({ mode: 'live' }).mode).toBe('live');
    expect(createRoomSchema.safeParse({ mode: 'solo' }).success).toBe(false);
    expect(createRoomSchema.safeParse({ categoryKeys: ['Bad!'] }).success).toBe(false);
  });
});

describe('roomCodeSchema', () => {
  it('accepts 6 unambiguous uppercase chars', () => {
    expect(roomCodeSchema.parse('ABCDEF')).toBe('ABCDEF');
    expect(roomCodeSchema.parse('H2J9NP')).toBe('H2J9NP');
  });

  it('rejects wrong length, lowercase, and ambiguous chars', () => {
    for (const bad of ['ABCDE', 'ABCDEFG', 'abcdef', 'ABCDEI', 'ABCDEO', 'ABCDE0', 'ABCDE1']) {
      expect(roomCodeSchema.safeParse(bad).success).toBe(false);
    }
  });
});
