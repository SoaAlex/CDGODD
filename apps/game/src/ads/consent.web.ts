/**
 * Web: no UMP SDK. Consent is the first-party banner (./consent-banner),
 * stored via useAdConsent and checked by each ad slot; nothing to gather
 * here.
 */
export function ensureAdsReady(): Promise<boolean> {
  return Promise.resolve(true);
}
