import { useCallback, useEffect, useRef, useState } from 'react';
import type { FilterMode } from '@/components/category-filter';
import { useCategories, type CategoryOption } from '@/hooks/use-categories';

/**
 * Categories dropped from the deck unless the player opts back in. Matched
 * case-insensitively against each category's key *and* its localized name, so
 * it survives the DB key casing (keys are lowercase, display names are
 * capitalized) and the French/English name split.
 */
const DEFAULT_EXCLUDED = ['nsfw', 'programmation', 'programming'];

/** Keys of the loaded categories that the default exclusion covers. */
export function defaultExcludedKeys(categories: CategoryOption[]): string[] {
  return categories
    .filter(
      (c) =>
        DEFAULT_EXCLUDED.includes(c.key.toLowerCase()) ||
        DEFAULT_EXCLUDED.includes(c.name.trim().toLowerCase()),
    )
    .map((c) => c.key);
}

export interface CategoryFilterState {
  keys: string[];
  mode: FilterMode;
  matchAll: boolean;
  setKeys: (keys: string[]) => void;
  setMode: (mode: FilterMode) => void;
  setMatchAll: (matchAll: boolean) => void;
}

/**
 * Category-filter state that starts by excluding the sensitive categories
 * (NSFW, Programmation). The exclusion is seeded once the category list loads
 * and only while the player hasn't touched the filter, so any deliberate
 * choice — including re-including those categories — wins. Session-only: it
 * resets on remount by design. If none of the loaded categories match, the
 * filter behaves as "all categories".
 */
export function useCategoryFilter(): CategoryFilterState {
  const { categories } = useCategories();
  const [keys, setKeysState] = useState<string[]>([]);
  const [mode, setModeState] = useState<FilterMode>('exclude');
  const [matchAll, setMatchAllState] = useState(false);
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current || categories.length === 0) return;
    const excluded = defaultExcludedKeys(categories);
    if (excluded.length > 0) setKeysState(excluded);
  }, [categories]);

  const setKeys = useCallback((next: string[]) => {
    touched.current = true;
    setKeysState(next);
  }, []);
  const setMode = useCallback((next: FilterMode) => {
    touched.current = true;
    setModeState(next);
  }, []);
  const setMatchAll = useCallback((next: boolean) => {
    touched.current = true;
    setMatchAllState(next);
  }, []);

  return { keys, mode, matchAll, setKeys, setMode, setMatchAll };
}
