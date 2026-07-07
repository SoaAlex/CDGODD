import { useCallback, useEffect, useRef } from 'react';
import { InterstitialAd, TestIds } from 'react-native-google-mobile-ads';
import { useAdsEnabled } from '@/lib/prefs';
import { ensureAdsReady } from './consent';

const INTERSTITIAL_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? TestIds.INTERSTITIAL;

/** Show an interstitial at most every N swipes. */
export const SWIPES_PER_INTERSTITIAL = 20;

/**
 * Native: preloads an interstitial and shows it every Nth call to
 * `onSwipe()`. Failing to load or show is always silent — ads never
 * block gameplay.
 */
export function useInterstitial() {
  const { adsEnabled, loaded } = useAdsEnabled();
  const ad = useRef<InterstitialAd | null>(null);
  const swipes = useRef(0);

  const preload = useCallback(() => {
    const next = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID);
    next.load();
    ad.current = next;
  }, []);

  useEffect(() => {
    if (!loaded || !adsEnabled) return;
    void ensureAdsReady().then((ok) => {
      if (ok) preload();
    });
  }, [loaded, adsEnabled, preload]);

  return useCallback(() => {
    if (!adsEnabled) return;
    swipes.current += 1;
    if (swipes.current % SWIPES_PER_INTERSTITIAL !== 0) return;
    const current = ad.current;
    if (current?.loaded) {
      try {
        void current.show();
      } catch {
        /* never interrupt the game for an ad error */
      }
      preload();
    }
  }, [adsEnabled, preload]);
}
