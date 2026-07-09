/**
 * Free-license image search for the admin image picker.
 *
 * Two sources, both queried server-side at review time:
 *  - Wikimedia Commons (no key): best for real entities — politicians,
 *    places, French things. Licenses vary, so results are filtered to
 *    genuinely free ones and carry attribution that must be displayed.
 *  - Pixabay (free key): generic concepts. Pixabay Content License needs
 *    no attribution, but its API terms require copying images to our own
 *    storage rather than hotlinking — which is exactly the picker's flow.
 */

export interface ImageCandidate {
  /** Small thumbnail for the admin grid (~320px). */
  thumbUrl: string;
  /** ~1024px version the server copies to R2 when picked. */
  fullUrl: string;
  source: 'wikimedia' | 'pixabay';
  author: string | null;
  /** Short license name: 'CC BY-SA 4.0', 'CC0', 'Public domain', 'Pixabay'. */
  license: string;
  /** Commons file page / Pixabay page URL, linked from the credit. */
  sourcePageUrl: string;
}

/**
 * Wikimedia policy requires a descriptive User-Agent (Workers send none by
 * default, which risks 403). Also sent when fetching image bytes.
 */
export const SOURCE_FETCH_UA =
  'cdgodd-api/1.0 (https://cestdegaucheoudedroite.com; l.soaresalex@gmail.com)';

const FETCH_TIMEOUT_MS = 8000;

/** Only genuinely free licenses; NC/ND and unknown strings are dropped. */
function isFreeLicense(shortName: string): boolean {
  if (/^(cc0|public domain|pd)/i.test(shortName)) return true;
  return /^cc[ -]by/i.test(shortName) && !/nc|nd/i.test(shortName);
}

interface WikimediaImageInfo {
  thumburl?: string;
  descriptionurl?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string } | undefined>;
}

interface WikimediaResponse {
  query?: {
    pages?: Record<string, { imageinfo?: WikimediaImageInfo[] }>;
  };
}

export async function searchWikimedia(q: string): Promise<ImageCandidate[]> {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json' +
    `&generator=search&gsrsearch=${encodeURIComponent(q)}` +
    '&gsrnamespace=6&gsrlimit=12' +
    '&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1024';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': SOURCE_FETCH_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as WikimediaResponse;
    const pages = Object.values(data.query?.pages ?? {});
    const candidates: ImageCandidate[] = [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl || !info.descriptionurl) continue;
      if (!info.mime?.startsWith('image/')) continue;
      const license = info.extmetadata?.LicenseShortName?.value?.trim();
      // Missing license metadata → treat as non-free (safe by default).
      if (!license || !isFreeLicense(license)) continue;
      const authorHtml = info.extmetadata?.Artist?.value ?? '';
      const author = authorHtml.replace(/<[^>]+>/g, '').trim() || null;
      // Commons thumb URLs are deterministic; a smaller grid thumb is the
      // same URL with the width prefix swapped. 330 is one of the allowed
      // thumbnail buckets (arbitrary widths get 400, see w.wiki/GHai).
      const thumbUrl = /\/\d+px-/.test(info.thumburl)
        ? info.thumburl.replace(/\/\d+px-/, '/330px-')
        : info.thumburl;
      candidates.push({
        thumbUrl,
        fullUrl: info.thumburl,
        source: 'wikimedia',
        author,
        license,
        sourcePageUrl: info.descriptionurl,
      });
    }
    return candidates;
  } catch {
    return [];
  }
}

interface PixabayHit {
  webformatURL: string;
  largeImageURL: string;
  user: string;
  pageURL: string;
}

export async function searchPixabay(
  q: string,
  key: string,
): Promise<ImageCandidate[]> {
  const url =
    `https://pixabay.com/api/?key=${encodeURIComponent(key)}` +
    `&q=${encodeURIComponent(q)}` +
    '&image_type=photo&safesearch=true&per_page=12&lang=fr';
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { hits?: PixabayHit[] };
    return (data.hits ?? []).map((hit) => ({
      thumbUrl: hit.webformatURL,
      fullUrl: hit.largeImageURL,
      source: 'pixabay' as const,
      author: hit.user || null,
      license: 'Pixabay',
      sourcePageUrl: hit.pageURL,
    }));
  } catch {
    return [];
  }
}

/** Hosts the image-from-source endpoint may fetch from (SSRF guard). */
export function isAllowedImageHost(
  source: 'wikimedia' | 'pixabay',
  hostname: string,
): boolean {
  if (source === 'wikimedia') return hostname === 'upload.wikimedia.org';
  return hostname === 'pixabay.com' || hostname === 'cdn.pixabay.com';
}
