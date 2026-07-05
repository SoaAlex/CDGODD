import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { ensureAdsReady } from './consent';

/** Real unit id in prod builds; Google's test banner otherwise. */
const BANNER_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? TestIds.BANNER;

/**
 * Native (iOS/Android): anchored adaptive AdMob banner, shown only after
 * the UMP consent flow has run. Reserve no space until an ad is actually
 * loaded so the layout never jumps for a failed fill.
 */
export function AdSlot() {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void ensureAdsReady().then(setReady);
  }, []);

  if (!ready) return null;

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
