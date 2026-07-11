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

/**
 * Maps the filter UI state to the include/exclude pair sent to the API.
 * Broad include selections (most categories left checked) are sent as an
 * exclude list of the unchecked complement: the request stays far under the
 * API's category cap, and items tagged with an unchecked category are
 * dropped even when they also carry a checked one — unchecking NSFW means
 * "no NSFW", not "NSFW is fine when it's also Food". Narrow selections and
 * matchAll keep the include list, where "in at least one / every selected
 * category" is the point.
 */
export function toApiFilter(
  mode: FilterMode,
  keys: string[],
  matchAll: boolean,
  allKeys: string[],
): { include: string[]; exclude: string[] } {
  if (mode === 'exclude') return { include: [], exclude: keys };
  if (matchAll || keys.length === 0 || allKeys.length === 0)
    return { include: keys, exclude: [] };
  const selected = new Set(keys);
  const unchecked = allKeys.filter((k) => !selected.has(k));
  if (unchecked.length === 0) return { include: [], exclude: [] };
  if (unchecked.length < keys.length)
    return { include: [], exclude: unchecked };
  return { include: keys, exclude: [] };
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
 * Category-filter state that starts in include mode with every category
 * selected except the sensitive ones (NSFW, Programmation). The selection is
 * seeded once the category list loads and only while the player hasn't
 * touched the filter, so any deliberate choice — including re-adding those
 * categories — wins. Session-only: it resets on remount by design. If none
 * of the loaded categories match the exclusion list, the filter stays empty,
 * which reads as "all categories".
 */
export function useCategoryFilter(): CategoryFilterState {
  const { categories } = useCategories();
  const [keys, setKeysState] = useState<string[]>([]);
  const [mode, setModeState] = useState<FilterMode>('include');
  const [matchAll, setMatchAllState] = useState(false);
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current || categories.length === 0) return;
    const excluded = defaultExcludedKeys(categories);
    if (excluded.length > 0) {
      setKeysState(
        categories.map((c) => c.key).filter((k) => !excluded.includes(k)),
      );
    }
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
