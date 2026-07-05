/** Web: no interstitials — they'd be hostile in a browser game. */
export const SWIPES_PER_INTERSTITIAL = Infinity;

export function useInterstitial() {
  return () => {};
}
