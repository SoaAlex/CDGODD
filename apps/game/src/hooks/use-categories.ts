import { useEffect, useState } from 'react';
import type { CategoriesResponse } from '@cdgodd/shared';
import { fetchCategories } from '@/lib/api';

export type CategoryOption = CategoriesResponse['categories'][number];

/** Localized category list from the API; empty until it loads (or on error). */
export function useCategories(): CategoryOption[] {
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    let alive = true;
    fetchCategories()
      .then(({ categories }) => {
        if (alive) setCategories(categories);
      })
      .catch(() => {
        /* filter simply doesn't show — the deck still works unfiltered */
      });
    return () => {
      alive = false;
    };
  }, []);

  return categories;
}
