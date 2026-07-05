/**
 * Web: no UMP SDK. AdSense (if configured) manages its own consent via
 * Google's CMP snippet in the host page; nothing to gather here.
 */
export function ensureAdsReady(): Promise<boolean> {
  return Promise.resolve(true);
}
