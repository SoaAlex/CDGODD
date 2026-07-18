/**
 * Web: no UMP SDK. Consent is handled by Google's CMP: the GDPR message
 * published in AdSense "Privacy & messaging" is displayed by the global
 * adsbygoogle.js tag in src/app/+html.tsx to EEA/UK visitors; nothing to
 * gather here.
 */
export function ensureAdsReady(): Promise<boolean> {
  return Promise.resolve(true);
}
