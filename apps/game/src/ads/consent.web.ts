import { useEffect, useState } from 'react';
import { H5_ADS_ENABLED } from './network';

/**
 * Web: no UMP SDK. On H5 Games Ads builds, consent is Google's certified CMP:
 * the GDPR message published in AdSense "Privacy & messaging" is displayed by
 * the global adsbygoogle.js tag in src/app/+html.tsx to EEA/UK/CH visitors,
 * and Google applies the choice to its own ad requests. On Adsterra builds it
 * is the first-party banner (./consent-banner), stored via useAdConsent and
 * checked by each ad slot. Nothing to gather here either way.
 */
export function ensureAdsReady(): Promise<boolean> {
  return Promise.resolve(true);
}

interface TcData {
  gdprApplies?: boolean;
  listenerId?: number;
}

declare global {
  interface Window {
    googlefc?: {
      callbackQueue?: Record<string, () => void>[];
      showRevocationMessage?: () => void;
    };
    __tcfapi?: (
      command: string,
      version: number,
      callback: (tcData: TcData | null, success: boolean) => void,
      listenerId?: number,
    ) => void;
  }
}

function showRevocationMessage(): void {
  window.googlefc?.showRevocationMessage?.();
}

/**
 * Reopens Google's consent message so the visitor can change their mind (CNIL:
 * withdrawing must stay as easy as accepting). Null while there's nothing to
 * open: until the CMP has loaded (never, with an ad blocker) and for visitors
 * GDPR doesn't apply to, who never get a message. Per Google's documented
 * pattern: https://developers.google.com/funding-choices/fc-api-docs
 */
export function useCookieChoices(): (() => void) | null {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!H5_ADS_ENABLED) return;
    let alive = true;
    let listenerId: number | undefined;
    const googlefc = (window.googlefc ??= {});
    (googlefc.callbackQueue ??= []).push({
      CONSENT_API_READY: () => {
        // Version 0 = the latest TCF version the CMP implements.
        window.__tcfapi?.('addEventListener', 0, (tcData, success) => {
          listenerId = tcData?.listenerId;
          if (alive) setAvailable(success && Boolean(tcData?.gdprApplies));
        });
      },
    });
    return () => {
      alive = false;
      if (listenerId !== undefined) {
        window.__tcfapi?.('removeEventListener', 0, () => {}, listenerId);
      }
    };
  }, []);

  return available ? showRevocationMessage : null;
}
