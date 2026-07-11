/**
 * Leading French determiners dropped when normalizing labels, longest first
 * so "de la " wins over "de ". Trailing space/apostrophe marks the boundary.
 */
const FR_DETERMINERS = [
  "de l'",
  'de la ',
  'des ',
  'les ',
  'une ',
  'de ',
  'du ',
  'la ',
  'le ',
  'un ',
  "d'",
  "l'",
];

/**
 * Canonical form of an item label for duplicate detection:
 * lowercase, accents folded, whitespace collapsed, typographic apostrophes
 * straightened, and one leading French determiner dropped — so
 * "Le Quinoa", "quinoa" and "LE QUINOA" all normalize to "quinoa".
 */
export function normalizeLabel(label: string): string {
  let s = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  for (const det of FR_DETERMINERS) {
    if (s.startsWith(det) && s.length > det.length) {
      s = s.slice(det.length).trim();
      break;
    }
  }
  return s;
}

/** Hard cap on custom words per multiplayer room. */
export const MAX_CUSTOM_WORDS = 50;

/** Longest custom word/phrase accepted (same cap as submitted item labels). */
export const MAX_CUSTOM_WORD_LENGTH = 80;

/**
 * Parse the host's free-text custom list (comma- or newline-separated) into
 * clean words: trimmed, empties dropped, overlong entries truncated,
 * duplicates removed (first occurrence's casing wins, compared via
 * normalizeLabel so "Le Quinoa" and "quinoa" collide), capped at
 * MAX_CUSTOM_WORDS.
 */
export function parseCustomWords(text: string): string[] {
  const words: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/[,\n]/)) {
    const word = part.trim().slice(0, MAX_CUSTOM_WORD_LENGTH).trim();
    if (!word) continue;
    const key = normalizeLabel(word);
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
    if (words.length >= MAX_CUSTOM_WORDS) break;
  }
  return words;
}
