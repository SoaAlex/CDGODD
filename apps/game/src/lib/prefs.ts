import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const SHOW_RESULTS_KEY = 'cdgodd.show_results';

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
