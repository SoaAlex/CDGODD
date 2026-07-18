import { useEffect, useRef } from 'react';
import { useAdsEnabled } from '@/lib/prefs';
import type { AdSlotProps } from './types';

const ADSENSE_CLIENT = process.env.EXPO_PUBLIC_ADSENSE_CLIENT;
const SLOT_BANNER =
  process.env.EXPO_PUBLIC_ADSENSE_SLOT_BANNER ??
  process.env.EXPO_PUBLIC_ADSENSE_SLOT;
const SLOT_SIDE = process.env.EXPO_PUBLIC_ADSENSE_SLOT_SIDE;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Web: an AdSense unit when EXPO_PUBLIC_ADSENSE_CLIENT and the placement's
 * slot id are set, nothing otherwise. Mobile (AdMob) is the primary ad
 * surface — web ads are optional reach, never required for the game to work.
 * `banner` is a responsive horizontal unit; `side` a fixed 160x600
 * wide skyscraper for desktop rails.
 */
export function AdSlot({ placement = 'banner' }: AdSlotProps) {
  const { adsEnabled, loaded } = useAdsEnabled();
  const pushed = useRef(false);

  const slot = placement === 'side' ? SLOT_SIDE : SLOT_BANNER;
  const active = Boolean(ADSENSE_CLIENT && slot) && loaded && adsEnabled;

  useEffect(() => {
    if (!active || pushed.current) return;
    pushed.current = true;
    // The loader normally already exists — +html.tsx puts it in the head of
    // every page (it also serves the GDPR consent message). Dedupe by src —
    // adsbygoogle.js warns about any custom data-* marker attribute on its
    // own script tag.
    const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    if (!document.querySelector(`script[src="${src}"]`)) {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }
    (window.adsbygoogle = window.adsbygoogle ?? []).push({});
  }, [active]);

  if (!active) return null;

  if (placement === 'side') {
    return (
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: 160, height: 600 }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
      />
    );
  }

  // Fixed-height responsive unit (full width, 100px). `data-ad-format="auto"`
  // + full-width-responsive let Google size the slot itself, which on a
  // 375px-wide phone produced a 375×375 square that shoved the menu off the
  // top of the viewport. A hard height keeps the layout intact whatever fill
  // Google picks (320×50, 320×100, 728×90…).
  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', width: '100%', height: 100 }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
    />
  );
}
