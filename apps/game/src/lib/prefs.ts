import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const SHOW_RESULTS_KEY = 'cdgodd.show_results';
const ADS_ENABLED_KEY = 'cdgodd.ads_enabled';

/**
 * "Show vote results after each swipe" preference. Off by default so a
 * player's own opinion isn't anchored by the crowd's.
 */
export function useShowResults(): {
  showResults: boolean;
  loaded: boolean;
  setShowResults: (v: boolean) => void;
} {
  const [showResults, set] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(SHOW_RESULTS_KEY).then((v) => {
      set(v === '1');
      setLoaded(true);
    });
  }, []);

  const setShowResults = useCallback((v: boolean) => {
    set(v);
    void AsyncStorage.setItem(SHOW_RESULTS_KEY, v ? '1' : '0');
  }, []);

  return { showResults, loaded, setShowResults };
}

/**
 * "Show ads" preference. On by default (only an explicit '0' disables);
 * consumers must wait for `loaded` so no ad flashes before the read resolves.
 */
export function useAdsEnabled(): {
  adsEnabled: boolean;
  loaded: boolean;
  setAdsEnabled: (v: boolean) => void;
} {
  const [adsEnabled, set] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(ADS_ENABLED_KEY).then((v) => {
      set(v !== '0');
      setLoaded(true);
    });
  }, []);

  const setAdsEnabled = useCallback((v: boolean) => {
    set(v);
    void AsyncStorage.setItem(ADS_ENABLED_KEY, v ? '1' : '0');
  }, []);

  return { adsEnabled, loaded, setAdsEnabled };
}
