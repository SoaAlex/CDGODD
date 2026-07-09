/**
 * Per-item boolean moderation flags. `key` matches the DB column and the
 * PATCH/POST field name; `label` is display-only and may be renamed freely.
 */
export interface ItemFlag {
  key: 'not_mobile' | 'nsfw';
  label: string;
}

export const ITEM_FLAGS: ItemFlag[] = [
  { key: 'not_mobile', label: 'Non adapté au mobile' },
  { key: 'nsfw', label: 'Contenu sensible (NSFW)' },
];
