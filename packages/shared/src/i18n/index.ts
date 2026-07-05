import fr from './fr.json';

export const resources = {
  fr: { translation: fr },
} as const;

export const supportedLangs = Object.keys(resources) as Array<
  keyof typeof resources
>;

export const defaultLang = 'fr' satisfies keyof typeof resources;
