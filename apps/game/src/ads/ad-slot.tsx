import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useAdsEnabled } from '@/lib/prefs';
import { ensureAdsReady } from './consent';
import type { AdSlotProps } from './types';

/**
 * AdMob units are per-app, hence per-platform ids (public by design —
 * they ship in the binary). Dev and preview builds always use Google's
 * test banner: clicking real ads during testing is AdMob policy abuse.
 */
const USE_TEST_ADS =
  __DEV__ || process.env.EXPO_PUBLIC_FORCE_TEST_ADS === '1';

const BANNER_UNIT_ID = USE_TEST_ADS
  ? TestIds.BANNER
  : (Platform.select({
      ios: 'ca-app-pub-5889686672909524/1263950512',
      android: 'ca-app-pub-5889686672909524/2818786326',
    }) ?? TestIds.BANNER);

/**
 * Native (iOS/Android): anchored adaptive AdMob banner, shown only after
 * the UMP consent flow has run. Reserve no space until an ad is actually
 * loaded so the layout never jumps for a failed fill. Side placements are
 * web-only desktop rails, so they render nothing here.
 */
export function AdSlot({ placement = 'banner' }: AdSlotProps) {
  const { adsEnabled, loaded: prefLoaded } = useAdsEnabled();
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const active = placement === 'banner' && prefLoaded && adsEnabled;

  useEffect(() => {
    if (!active) return;
    void ensureAdsReady().then(setReady);
  }, [active]);

  if (!active || !ready) return null;

  return (
    <View style={loaded ? styles.slot : styles.hidden}>
      <BannerAd
        unitId={BANNER_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
  },
  hidden: {
    height: 0,
    overflow: 'hidden',
  },
});
