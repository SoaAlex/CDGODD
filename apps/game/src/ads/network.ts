import { Platform } from 'react-native';

/**
 * Web ad network, picked at build time so switching is one CI variable rather
 * than a code change (WEB_AD_NETWORK, see deploy.yml): Google H5 Games Ads by
 * default, Adsterra banners as the fallback. Never both on one page. Native
 * is always AdMob, whatever this says.
 */
export const WEB_AD_NETWORK: 'h5' | 'adsterra' =
  process.env.EXPO_PUBLIC_WEB_AD_NETWORK === 'adsterra' ? 'adsterra' : 'h5';

/** AdSense publisher id, public by design (visible in page source). */
export const ADSENSE_CLIENT = process.env.EXPO_PUBLIC_ADSENSE_CLIENT;

/** Whether this web build serves H5 Games Ads. No publisher id = ad-free. */
export const H5_ADS_ENABLED =
  Platform.OS === 'web' && WEB_AD_NETWORK === 'h5' && Boolean(ADSENSE_CLIENT);

/**
 * Fake ads instead of real ones. Preview builds and local testing only:
 * clicking real ads during testing is AdSense policy abuse.
 */
export const H5_ADS_TEST = process.env.EXPO_PUBLIC_H5_ADS_TEST === 'on';
