import { useAdConsent, useAdsEnabled } from '@/lib/prefs';
import { adSnippet, adUnit } from './adsterra';
import type { AdSlotProps } from './types';

/**
 * Web: an Adsterra banner when the placement's unit is configured (see
 * ./adsterra), nothing otherwise. Loads only once the visitor accepted ad
 * cookies in the consent banner and hasn't switched ads off in settings.
 * Mobile (AdMob) is the primary ad surface — web ads are optional reach,
 * never required for the game to work. `banner` is a centered 320x50 unit;
 * `side` a fixed 160x600 skyscraper for desktop rails.
 *
 * Both prefs start unloaded on the server and during hydration, so the slot
 * renders nothing until after hydration (no #418 mismatch).
 */
export function AdSlot({ placement = 'banner' }: AdSlotProps) {
  const { adsEnabled, loaded } = useAdsEnabled();
  const { consent, loaded: consentLoaded } = useAdConsent();

  const unit = adUnit(placement);
  if (!unit || !loaded || !adsEnabled || !consentLoaded) return null;
  if (consent !== 'granted') return null;

  return (
    <iframe
      title="Publicité"
      srcDoc={adSnippet(unit)}
      width={unit.width}
      height={unit.height}
      style={{
        border: 0,
        display: 'block',
        margin: '0 auto',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    />
  );
}
