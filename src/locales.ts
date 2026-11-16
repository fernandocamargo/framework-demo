/// <reference path="../framework/plugin/messages.d.ts" />
// The locales the app speaks, and the part of the address that says which one shows:
// the generated query's lang field, carried by every link.
import { address, inPlace } from './address';

export { default as preloadLocale } from 'virtual:framework/messages';

export const LOCALES = ['en', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];

/** The locale the app speaks for a tag, `pt-BR` for `pt-PT` or `pt`; null for one it does not. */
const spoken = (tag: null | string | undefined): Locale | null =>
  !tag
    ? null
    : (LOCALES.find((locale) => locale.toLowerCase() === tag.toLowerCase()) ??
      LOCALES.find((locale) => locale.split('-')[0] === tag.split('-')[0]?.toLowerCase()) ??
      null);

/** The locale the address asks for; or the first of the browser's the app speaks; or English. */
export const currentLocale = (asked = address.latest().query['lang'] as string): Locale =>
  spoken(asked) ?? navigator.languages.map(spoken).find((locale) => locale !== null) ?? 'en';

/** Shows the page in another locale: the address changes in place, and the shell follows. */
export const speak = (locale: Locale) => {
  // The page may speak it already with no language in its address (the browser's): nothing to write then.
  if (currentLocale() !== locale) inPlace({ lang: locale });
};

/** A locale's name in that locale: "English", "Português (Brasil)". */
export const endonym = (locale: Locale) => {
  const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
};
