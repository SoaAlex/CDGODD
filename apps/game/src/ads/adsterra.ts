import { Platform } from 'react-native';
import type { AdPlacement } from './types';

/**
 * Web ad network: Adsterra banners (AdSense refused the site). The unit keys
 * and the script host come from each unit's code snippet in the Adsterra
 * dashboard; they're public by design (visible in page source). Banner
 * units ONLY — never enable Adsterra's popunder / social bar / push /
 * direct-link formats, they wreck the game and get sites flagged.
 */
export interface AdUnit {
  key: string;
  width: number;
  height: number;
}

const HOST = process.env.EXPO_PUBLIC_ADSTERRA_HOST;
const KEYS: Record<AdPlacement, string | undefined> = {
  banner: process.env.EXPO_PUBLIC_ADSTERRA_KEY_BANNER,
  side: process.env.EXPO_PUBLIC_ADSTERRA_KEY_SIDE,
};
const SIZES: Record<AdPlacement, { width: number; height: number }> = {
  banner: { width: 320, height: 50 },
  side: { width: 160, height: 600 },
};

// The values end up inside generated HTML (adSnippet), so only accept the
// shapes Adsterra actually hands out: a bare hostname (optional port, for
// local stubs) and an alphanumeric key.
const VALID_HOST =
  HOST && /^[a-z0-9.-]+(:\d+)?$/i.test(HOST) ? HOST : undefined;

export function adUnit(placement: AdPlacement): AdUnit | undefined {
  const key = KEYS[placement];
  if (!VALID_HOST || !key || !/^[a-z0-9]+$/i.test(key)) return undefined;
  return { key, ...SIZES[placement] };
}

/** Whether this web build serves ads at all (and so must ask consent). */
export const WEB_ADS_CONFIGURED =
  Platform.OS === 'web' &&
  (adUnit('banner') !== undefined || adUnit('side') !== undefined);

/**
 * Adsterra's own banner snippet as a standalone document, rendered in an
 * <iframe srcdoc> per slot: each unit gets its own `atOptions` global (the
 * snippet's config is one global, so two units in one document race), and
 * unmounting the iframe on navigation cleans everything up. A srcdoc
 * document resolves the protocol-relative script URL against the page.
 */
export function adSnippet(unit: AdUnit): string {
  const options = JSON.stringify({
    key: unit.key,
    format: 'iframe',
    height: unit.height,
    width: unit.width,
    params: {},
  });
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style>' +
    '</head><body>' +
    `<script>atOptions=${options};</script>` +
    `<script src="//${VALID_HOST}/${unit.key}/invoke.js"></script>` +
    '</body></html>'
  );
}
