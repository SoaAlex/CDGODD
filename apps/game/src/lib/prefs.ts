import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const SHOW_RESULTS_KEY = 'cdgodd.show_results';
const SHOW_LAST_VOTE_KEY = 'cdgodd.show_last_vote';
const ADS_ENABLED_KEY = 'cdgodd.ads_enabled';

/**
 * Boolean preference persisted in AsyncStorage ('1'/'0'); `defaultValue`
 * applies until an explicit choice is stored. Consumers that must not flash
 * the wrong state wait for `loaded`.
 */
function useBoolPref(
  key: string,
  defaultValue: boolean,
): { value: boolean; loaded: boolean; setValue: (v: boolean) => void } {
  const [value, set] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(key).then((v) => {
      set(v === null ? defaultValue : v === '1');
      setLoaded(true);
    });
  }, [key, defaultValue]);

  const setValue = useCallback(
    (v: boolean) => {
      set(v);
      void AsyncStorage.setItem(key, v ? '1' : '0');
    },
    [key],
  );

  return { value, loaded, setValue };
}

/**
 * "Show vote results after each swipe" preference. Off by default so a
 * player's own opinion isn't anchored by the crowd's.
 */
export function useShowResults(): {
  showResults: boolean;
  loaded: boolean;
  setShowResults: (v: boolean) => void;
} {
  const { value, loaded, setValue } = useBoolPref(SHOW_RESULTS_KEY, false);
  return { showResults: value, loaded, setShowResults: setValue };
}

/**
 * "Show the previous vote's result while playing" preference (the white
 * panel under the deck in solo). On by default — it only reveals the crowd's
 * take on a card you already voted on.
 */
export function useShowLastVote(): {
  showLastVote: boolean;
  loaded: boolean;
  setShowLastVote: (v: boolean) => void;
} {
  const { value, loaded, setValue } = useBoolPref(SHOW_LAST_VOTE_KEY, true);
  return { showLastVote: value, loaded, setShowLastVote: setValue };
}

/**
 * "Show ads" preference. On by default; consumers must wait for `loaded` so
 * no ad flashes before the read resolves.
 */
export function useAdsEnabled(): {
  adsEnabled: boolean;
  loaded: boolean;
  setAdsEnabled: (v: boolean) => void;
} {
  const { value, loaded, setValue } = useBoolPref(ADS_ENABLED_KEY, true);
  return { adsEnabled: value, loaded, setAdsEnabled: setValue };
}
