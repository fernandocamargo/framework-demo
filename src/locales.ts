// The locales the app speaks, and the part of the address that says which one shows:
// `?lang=pt-BR`, before the hash, beside `?world=memory`, so every link inside the app keeps it.
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
export const currentLocale = (): Locale =>
  spoken(new URLSearchParams(window.location.search).get('lang')) ??
  navigator.languages.map(spoken).find((locale) => locale !== null) ??
  'en';

/** Shows the page in another locale: the address changes in place, and the shell follows. */
export const speak = (locale: Locale) => {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', locale);
  window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new Event('localechange'));
};

/** A locale's name in that locale: "English", "Português (Brasil)". */
export const endonym = (locale: Locale) => {
  const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
};
