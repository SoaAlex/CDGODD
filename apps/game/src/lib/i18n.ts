import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { defaultLang, resources, supportedLangs } from '@cdgodd/shared/i18n';

/**
 * Minimal typed i18n over the shared resource bundles.
 *
 * Components MUST get `t`/`categoryName` from the `useT()` hook, not from a
 * module-level function: React Compiler (enabled in app.json) caches JSX by
 * its reactive dependencies, and a plain `t('key')` call has none — its
 * output would be frozen at first render and survive a language switch. The
 * hook returns a new function identity per language, which the compiler
 * tracks like any other reactive value.
 */
export type Lang = (typeof supportedLangs)[number];

type Messages = (typeof resources)[typeof defaultLang]['translation'];

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

const LANG_KEY = 'cdgodd.lang';

let current: Lang = defaultLang;
let ready = false;
const listeners = new Set<() => void>();

function isLang(v: unknown): v is Lang {
  return (
    typeof v === 'string' && (supportedLangs as readonly string[]).includes(v)
  );
}

/** First device/browser language we support; French otherwise. */
function detectLang(): Lang {
  for (const locale of getLocales()) {
    const code = locale.languageCode?.toLowerCase();
    if (isLang(code)) return code;
  }
  return defaultLang;
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Keep <html lang> in sync so the browser/screen readers know the language. */
function syncDocumentLang(): void {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.lang = current;
  }
}

// Resolve once at startup: stored choice wins, then device language, then
// French. RootLayout gates first paint on `useLangReady` to avoid a flash.
void AsyncStorage.getItem(LANG_KEY)
  .then(
    (stored) => {
      current = isLang(stored) ? stored : detectLang();
    },
    () => {
      current = detectLang();
    },
  )
  .finally(() => {
    ready = true;
    syncDocumentLang();
    notify();
  });

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  void AsyncStorage.setItem(LANG_KEY, lang);
  syncDocumentLang();
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current language; the subscribing component re-renders on change. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

/** True once the stored preference has been read. */
export function useLangReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => ready,
    () => ready,
  );
}

function translate(lang: Lang, key: MessageKey): string {
  let node: unknown = resources[lang].translation;
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : key;
}

/**
 * Localized display name for a dynamic category key coming from the API.
 * Falls back to the raw key when no translation exists yet.
 */
function categoryNameFor(lang: Lang, key: string): string {
  const categories = resources[lang].translation.categories as Record<
    string,
    string
  >;
  const name = categories[key] ?? key;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export interface I18n {
  lang: Lang;
  t: (key: MessageKey) => string;
  categoryName: (key: string) => string;
}

// One frozen bundle per language so `t` keeps a stable identity while the
// language doesn't change, and gets a NEW identity when it does.
const bundles = new Map<Lang, I18n>();

function bundleFor(lang: Lang): I18n {
  let bundle = bundles.get(lang);
  if (!bundle) {
    bundle = {
      lang,
      t: (key) => translate(lang, key),
      categoryName: (key) => categoryNameFor(lang, key),
    };
    bundles.set(lang, bundle);
  }
  return bundle;
}

/** Translation functions for the current language; see module doc above. */
export function useT(): I18n {
  return bundleFor(useLang());
}
