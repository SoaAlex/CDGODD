import { describe, expect, it } from 'vitest';
import { normalizeLabel } from './text';

describe('normalizeLabel', () => {
  it('lowercases and drops one leading determiner', () => {
    expect(normalizeLabel('Le Quinoa')).toBe('quinoa');
    expect(normalizeLabel('LE QUINOA')).toBe('quinoa');
    expect(normalizeLabel('quinoa')).toBe('quinoa');
    expect(normalizeLabel('les Impôts')).toBe('impots');
    expect(normalizeLabel('du vin')).toBe('vin');
    expect(normalizeLabel('une olive')).toBe('olive');
  });

  it('folds accents (NFD combining marks only — œ survives)', () => {
    expect(normalizeLabel('Le théâtre')).toBe('theatre');
    expect(normalizeLabel('La côte de bœuf')).toBe('cote de bœuf');
  });

  it('straightens typographic apostrophes', () => {
    expect(normalizeLabel('l’état')).toBe('etat');
    expect(normalizeLabel("L'école")).toBe('ecole');
    expect(normalizeLabel('lʼavenir')).toBe('avenir');
  });

  it('matches the longest determiner first', () => {
    expect(normalizeLabel("de l'or")).toBe('or');
    expect(normalizeLabel('de la crème')).toBe('creme');
    expect(normalizeLabel('de plomb')).toBe('plomb');
  });

  it('keeps determiner-only strings intact', () => {
    expect(normalizeLabel('Le')).toBe('le');
    expect(normalizeLabel('la ')).toBe('la');
    expect(normalizeLabel("l'")).toBe("l'");
  });

  it('does not strip words that merely start like a determiner', () => {
    expect(normalizeLabel('lessive')).toBe('lessive');
    expect(normalizeLabel('lavande')).toBe('lavande');
    expect(normalizeLabel('lundi')).toBe('lundi');
  });

  it('collapses whitespace before stripping', () => {
    expect(normalizeLabel('  le   vélo   cargo ')).toBe('velo cargo');
  });

  it('strips only one determiner', () => {
    expect(normalizeLabel('le le vélo')).toBe('le velo');
  });
});
