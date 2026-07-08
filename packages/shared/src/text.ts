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
