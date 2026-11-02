import { useEffect, useMemo } from 'react';
import { isMusicMuted, setMusicSuspended } from '@/lib/music';
import { useAdsEnabled } from '@/lib/prefs';
import { isSfxMuted, setSfxSuspended } from '@/lib/sfx';
import { H5_ADS_ENABLED } from './network';
import type { RequestAdBreak } from './types';

/** See https://developers.google.com/ad-placement/apis/adbreak */
interface PlacementInfo {
  breakType: string;
  breakName: string;
  breakFormat: string;
  breakStatus: string;
}

declare global {
  interface Window {
    // Both defined by the inline init script in src/app/+html.tsx; undefined
    // on builds that don't serve H5 Games Ads.
    adBreak?: (placement: {
      type: string;
      name: string;
      beforeAd: () => void;
      afterAd: () => void;
      adBreakDone: (info: PlacementInfo) => void;
    }) => void;
    adConfig?: (config: {
      preloadAdBreaks?: 'on' | 'auto';
      sound?: 'on' | 'off';
    }) => void;
  }
}

let showing = false;

/** True while a full-screen ad is up: the game must ignore keyboard input. */
export function isAdBreakActive(): boolean {
  return showing;
}

function pauseForAd(): void {
  showing = true;
  setMusicSuspended(true);
  setSfxSuspended(true);
}

function resumeAfterAd(): void {
  if (!showing) return;
  showing = false;
  setMusicSuspended(false);
  setSfxSuspended(false);
}

function soundState(): 'on' | 'off' {
  return isMusicMuted() && isSfxMuted() ? 'off' : 'on';
}

/** Tells Google the game's sound state changed, so it can pick fitting ads. */
export function syncAdSound(): void {
  window.adConfig?.({ sound: soundState() });
}

/**
 * Asks Google to preload ads as soon as ads are allowed, so a `start` break on
 * entering the game has something to show. preloadAdBreaks only counts the
 * first time; calling again (ads switched back on) is harmless.
 */
export function useAdsPreload(): void {
  const { adsEnabled, loaded } = useAdsEnabled();
  useEffect(() => {
    if (!H5_ADS_ENABLED || !loaded || !adsEnabled) return;
    window.adConfig?.({ preloadAdBreaks: 'on', sound: soundState() });
  }, [loaded, adsEnabled]);
}

/**
 * Null until ads are known to be allowed (never, on non-H5 builds or with the
 * settings switch off). Calling it only declares that an ad *could* show:
 * Google decides, and its callbacks don't fire at all when it passes. So this
 * is fire-and-forget: the game never waits on it, and an ad blocker (the
 * script never loads, nothing ever calls back) changes nothing.
 */
export function useAdBreak(): RequestAdBreak | null {
  const { adsEnabled, loaded } = useAdsEnabled();
  return useMemo(() => {
    if (!H5_ADS_ENABLED || !loaded || !adsEnabled) return null;
    return (type, name) => {
      // A second adBreak() during an ad fails with a console warning.
      if (showing) return;
      window.adBreak?.({
        type,
        name,
        beforeAd: pauseForAd,
        afterAd: resumeAfterAd,
        adBreakDone: (info) => {
          resumeAfterAd();
          // Why no ad showed (frequencyCapped, noAdPreloaded…), for devtools.
          console.debug(`[ads] ${info.breakName}: ${info.breakStatus}`);
        },
      });
    };
  }, [loaded, adsEnabled]);
}
