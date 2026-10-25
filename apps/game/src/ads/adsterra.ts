import { Platform } from 'react-native';
import type { AdPlacement } from './types';

/**
 * Web ad network: Adsterra banners (AdSense refused the site). Each unit is
 * configured with the script URL from its code snippet in the Adsterra
 * dashboard (`<script src="https://bauval.org/22/<key>">` — the domain
 * rotates per account, so it's config, not code); the unit key is read back
 * from that URL. Both are public by design (visible in page source). Banner
 * units ONLY — never enable Adsterra's popunder / social bar / push /
 * direct-link formats, they wreck the game and get sites flagged.
 */
export interface AdUnit {
  key: string;
  src: string;
  width: number;
  height: number;
}

const SRCS: Record<AdPlacement, string | undefined> = {
  banner: process.env.EXPO_PUBLIC_ADSTERRA_SRC_BANNER,
  side: process.env.EXPO_PUBLIC_ADSTERRA_SRC_SIDE,
};
const SIZES: Record<AdPlacement, { width: number; height: number }> = {
  banner: { width: 320, height: 50 },
  side: { width: 160, height: 600 },
};

// The URL ends up inside generated HTML (adSnippet), so only accept plain
// http(s) URLs with simple path segments — no quotes, brackets or queries.
const SRC_PATTERN = /^https?:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[a-z0-9._-]+)+$/i;
// Unit keys are long alphanumeric ids (32 hex chars today).
const KEY_PATTERN = /^[a-z0-9]{16,}$/i;

export function adUnit(placement: AdPlacement): AdUnit | undefined {
  const src = SRCS[placement];
  if (!src || !SRC_PATTERN.test(src)) return undefined;
  const key = src
    .replace(/^https?:\/\/[^/]+/, '')
    .split('/')
    .find((segment) => KEY_PATTERN.test(segment));
  if (!key) return undefined;
  return { key, src, ...SIZES[placement] };
}

/** Whether this web build serves ads at all (and so must ask consent). */
export const WEB_ADS_CONFIGURED =
  Platform.OS === 'web' &&
  (adUnit('banner') !== undefined || adUnit('side') !== undefined);

/**
 * Adsterra's own banner snippet as a standalone document, rendered in an
 * <iframe srcdoc> per slot: each unit gets its own `atOptions` global (the
 * snippet's config is one global, so two units in one document race), and
 * unmounting the iframe on navigation cleans everything up.
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
    `<script src="${unit.src}"></script>` +
    '</body></html>'
  );
}
