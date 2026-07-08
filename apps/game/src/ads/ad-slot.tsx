import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useAdsEnabled } from '@/lib/prefs';
import { ensureAdsReady } from './consent';
import type { AdSlotProps } from './types';

/** Real unit id in prod builds; Google's test banner otherwise. */
const BANNER_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? TestIds.BANNER;

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
