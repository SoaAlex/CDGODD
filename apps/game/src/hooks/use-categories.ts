import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { CategoriesResponse } from '@cdgodd/shared';
import { fetchCategories } from '@/lib/api';
import { useLang, type Lang } from '@/lib/i18n';

export type CategoryOption = CategoriesResponse['categories'][number];

interface CategoryData {
  categories: CategoryOption[];
  total: number;
  /** key -> localized display name, derived once per fetch. */
  names: Record<string, string>;
}

const EMPTY: CategoryData = { categories: [], total: 0, names: {} };

/**
 * Module-level store: one /categories fetch per language, shared by every
 * consumer (filter UI, card category lines, room header). The DB is the
 * single source of truth for category names — the API localizes them with a
 * French fallback — so nothing is read from the i18n bundles here.
 */
const cache = new Map<Lang, CategoryData>();
const inflight = new Set<Lang>();
const listeners = new Set<() => void>();

function load(lang: Lang): void {
  if (cache.has(lang) || inflight.has(lang)) return;
  inflight.add(lang);
  fetchCategories(lang)
    .then(({ categories, total }) => {
      cache.set(lang, {
        categories,
        total,
        names: Object.fromEntries(categories.map((c) => [c.key, c.name])),
      });
      for (const listener of listeners) listener();
    })
    .catch(() => {
      /* filter simply doesn't show — the deck still works unfiltered;
         a later mount retries since nothing was cached */
    })
    .finally(() => {
      inflight.delete(lang);
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useCategoryData(): CategoryData {
  const lang = useLang();
  useEffect(() => {
    load(lang);
  }, [lang]);
  return useSyncExternalStore(
    subscribe,
    () => cache.get(lang) ?? EMPTY,
    () => cache.get(lang) ?? EMPTY,
  );
}

/**
 * Localized category list (with approved-item counts) from the API;
 * empty until it loads (or on error). `total` is the approved-item count
 * across all categories. Refetches when the UI language changes.
 */
export function useCategories(): { categories: CategoryOption[]; total: number } {
  const { categories, total } = useCategoryData();
  return { categories, total };
}

/**
 * Localized display name for a dynamic category key coming from the API.
 * Falls back to the (capitalized) raw key until the list loads. New function
 * identity when the data or language changes, so React Compiler re-renders
 * memoized JSX that uses it.
 */
export function useCategoryName(): (key: string) => string {
  const { names } = useCategoryData();
  return useCallback(
    (key: string) => {
      const name = names[key] ?? key;
      return name.charAt(0).toUpperCase() + name.slice(1);
    },
    [names],
  );
}
