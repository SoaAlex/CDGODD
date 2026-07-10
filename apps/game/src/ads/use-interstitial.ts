import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { InterstitialAd, TestIds } from 'react-native-google-mobile-ads';
import { useAdsEnabled } from '@/lib/prefs';
import { ensureAdsReady } from './consent';

/**
 * AdMob units are per-app, hence per-platform ids (public by design —
 * they ship in the binary). Dev builds always use Google's test unit:
 * clicking real ads during development is AdMob policy abuse.
 */
const INTERSTITIAL_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : (Platform.select({
      ios: 'ca-app-pub-5889686672909524/6181235272',
      android: 'ca-app-pub-5889686672909524/1505704657',
    }) ?? TestIds.INTERSTITIAL);

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
