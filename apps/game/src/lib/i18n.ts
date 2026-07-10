import { resources } from '@cdgodd/shared/i18n';

/**
 * Minimal typed i18n. French-only for now; when more languages land,
 * swap the lookup for i18next without touching call sites.
 */
const fr = resources.fr.translation;
type Messages = typeof fr;

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

export function t(key: MessageKey): string {
  let node: unknown = fr;
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : key;
}

/**
 * Localized display name for a dynamic category key coming from the API.
 * Falls back to the raw key when no translation exists yet.
 */
export function categoryName(key: string): string {
  const name = (fr.categories as Record<string, string>)[key] ?? key;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
