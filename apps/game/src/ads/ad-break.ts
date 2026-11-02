import type { RequestAdBreak } from './types';

/** Native: interstitials go through AdMob (./use-interstitial), no ad breaks. */
export function useAdBreak(): RequestAdBreak | null {
  return null;
}

export function useAdsPreload(): void {}

export function isAdBreakActive(): boolean {
  return false;
}

export function syncAdSound(): void {}
