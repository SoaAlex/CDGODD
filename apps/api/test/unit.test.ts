import { describe, expect, it } from 'vitest';
import { isBlocked, REPORT_AUTO_HIDE_THRESHOLD } from '../src/moderation';
import { isAllowedImageHost } from '../src/image-sources';

describe('moderation', () => {
  it('blocks offensive labels', () => {
    expect(isBlocked('Hitler')).toBe(true);
    expect(isBlocked('les blagues nazi')).toBe(true);
    expect(isBlocked('la pédophilie')).toBe(true);
  });

  it('lets normal labels through', () => {
    expect(isBlocked('Le quinoa')).toBe(false);
    expect(isBlocked('La chasse')).toBe(false);
  });

  it('respects word boundaries (documented behavior)', () => {
    // 'nazi' inside a longer word does not match \bnazi\b — the trailing
    // boundary fails. Pin it so a blocklist rework is deliberate.
    expect(isBlocked('dénazification')).toBe(false);
  });

  it('pins the auto-hide threshold the reports tests rely on', () => {
    expect(REPORT_AUTO_HIDE_THRESHOLD).toBe(5);
  });
});

describe('isAllowedImageHost (SSRF guard)', () => {
  it('wikimedia only fetches from upload.wikimedia.org', () => {
    expect(isAllowedImageHost('wikimedia', 'upload.wikimedia.org')).toBe(true);
    expect(isAllowedImageHost('wikimedia', 'commons.wikimedia.org')).toBe(false);
    expect(isAllowedImageHost('wikimedia', 'evil.com')).toBe(false);
  });

  it('pixabay only fetches from pixabay hosts', () => {
    expect(isAllowedImageHost('pixabay', 'pixabay.com')).toBe(true);
    expect(isAllowedImageHost('pixabay', 'cdn.pixabay.com')).toBe(true);
    expect(isAllowedImageHost('pixabay', 'evil.com')).toBe(false);
  });

  it('rejects cross-source host spoofing', () => {
    expect(isAllowedImageHost('wikimedia', 'pixabay.com')).toBe(false);
    expect(isAllowedImageHost('pixabay', 'upload.wikimedia.org')).toBe(false);
  });
});
