export type ItemStatus = 'pending' | 'approved' | 'rejected';

export interface AdminItem {
  id: number;
  label: string | null;
  status: ItemStatus;
  image_key: string | null;
  image_source: string | null;
  image_author: string | null;
  image_license: string | null;
  image_source_url: string | null;
  votes_left: number;
  votes_right: number;
  report_count: number;
  created_at: number;
  /** Parsed client-side from the API's CSV `category_keys` column. */
  category_keys: string[];
}

/** GET /admin/image-candidates result row (Wikimedia Commons / Pixabay). */
export interface ImageCandidate {
  thumbUrl: string;
  fullUrl: string;
  source: 'wikimedia' | 'pixabay';
  author: string | null;
  license: string;
  sourcePageUrl: string;
}

export interface AdminReport {
  id: number;
  item_id: number;
  label: string | null;
  reason: string | null;
  status: ItemStatus;
  report_count: number;
  created_at: number;
}

export interface Category {
  key: string;
  name: string;
}

/** GET /admin/categories row: category with all its translations. */
export interface AdminCategory {
  id: number;
  key: string;
  translations: Record<string, string>;
}

/** GET /admin/items/:id/translations row. */
export interface ItemTranslation {
  lang: string;
  label: string;
}

export interface Stats {
  items: number;
  votesLeft: number;
  votesRight: number;
}
