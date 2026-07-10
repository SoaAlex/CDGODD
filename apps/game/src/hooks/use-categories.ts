import { useEffect, useState } from 'react';
import type { CategoriesResponse } from '@cdgodd/shared';
import { fetchCategories } from '@/lib/api';

export type CategoryOption = CategoriesResponse['categories'][number];

/**
 * Localized category list (with approved-item counts) from the API;
 * empty until it loads (or on error). `total` is the approved-item count
 * across all categories.
 */
export function useCategories(): { categories: CategoryOption[]; total: number } {
  const [data, setData] = useState<{
    categories: CategoryOption[];
    total: number;
  }>({ categories: [], total: 0 });

  useEffect(() => {
    let alive = true;
    fetchCategories()
      .then(({ categories, total }) => {
        if (alive) setData({ categories, total });
      })
      .catch(() => {
        /* filter simply doesn't show — the deck still works unfiltered */
      });
    return () => {
      alive = false;
    };
  }, []);

  return data;
}
