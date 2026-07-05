import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';

let ready: Promise<boolean> | null = null;

/**
 * Gathers UMP consent (GDPR prompt on first ad in the EEA) and starts the
 * Mobile Ads SDK. The game itself never blocks on this — it only gates ad
 * display. Declining consent means Google serves limited/non-personalized
 * ads; gameplay is unaffected.
 *
 * Resolves true when ads can be requested.
 */
export function ensureAdsReady(): Promise<boolean> {
  ready ??= (async () => {
    try {
      await AdsConsent.gatherConsent();
      await mobileAds().initialize();
      return true;
    } catch {
      // Consent flow unavailable (e.g. network) — try again next launch.
      ready = null;
      return false;
    }
  })();
  return ready;
}
