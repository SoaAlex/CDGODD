import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import nl from './nl.json';
import pt from './pt.json';

/** French is the reference bundle: every language must cover its keys. */
type Messages = typeof fr;

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
  pt: { translation: pt },
  es: { translation: es },
  nl: { translation: nl },
} as const satisfies Record<string, { translation: Messages }>;

export const supportedLangs = Object.keys(resources) as Array<
  keyof typeof resources
>;

export const defaultLang = 'fr' satisfies keyof typeof resources;
