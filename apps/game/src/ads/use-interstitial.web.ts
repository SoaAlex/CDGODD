import { useCallback, useRef } from 'react';
import { useAdBreak } from './ad-break';

/**
 * Request an ad break every N swipes, the same pace as AdMob on native.
 * Google's frequency cap (data-ad-frequency-hint in src/app/+html.tsx) has the
 * last word on whether one actually shows.
 */
export const SWIPES_PER_INTERSTITIAL = 20;

/** Web: `next` ad break every Nth call to `onSwipe()` (H5 builds only). */
export function useInterstitial() {
  const adBreak = useAdBreak();
  const swipes = useRef(0);

  return useCallback(() => {
    swipes.current += 1;
    if (swipes.current % SWIPES_PER_INTERSTITIAL !== 0) return;
    adBreak?.('next', 'solo-swipes');
  }, [adBreak]);
}
