import { useEffect, useRef } from 'react';

const ADSENSE_CLIENT = process.env.EXPO_PUBLIC_ADSENSE_CLIENT;
const ADSENSE_SLOT = process.env.EXPO_PUBLIC_ADSENSE_SLOT;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Web: an AdSense unit when EXPO_PUBLIC_ADSENSE_CLIENT/SLOT are set,
 * nothing otherwise. Mobile (AdMob) is the primary ad surface — web ads
 * are optional reach, never required for the game to work.
 */
export function AdSlot() {
  const pushed = useRef(false);

  useEffect(() => {
    if (!ADSENSE_CLIENT || !ADSENSE_SLOT || pushed.current) return;
    pushed.current = true;
    if (!document.querySelector('script[data-cdgodd-adsense]')) {
      const script = document.createElement('script');
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.setAttribute('data-cdgodd-adsense', '1');
      document.head.appendChild(script);
    }
    (window.adsbygoogle = window.adsbygoogle ?? []).push({});
  }, []);

  if (!ADSENSE_CLIENT || !ADSENSE_SLOT) return null;

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', minHeight: 50 }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={ADSENSE_SLOT}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
