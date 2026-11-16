// The generated codec writes links. React Router owns matching and navigation.
import codec from 'virtual:framework/address';

import type { Navigation, Route, Values } from 'framework';

export const STATES = '#/states';
export { codec };
export type Filters = Pick<Route, 'category' | 'order' | 'page' | 'q' | 'sort'>;

export type Settings = Pick<Route, 'lang' | 'signin' | 'skin' | 'world'>;

export const settingsOf = ({ lang, signin, skin, world }: Settings): Settings => ({ lang, signin, skin, world });
export const HOME: Filters = { category: '', order: 'asc', page: 1, q: '', sort: 'title' };
export const ORDERS_HOME = { page: 1, region: '' };
export const SECTIONS = ['products', 'report', 'orders'] as const;
export type Section = (typeof SECTIONS)[number];

export const openSection = (navigation: Navigation, section: Section) =>
  section === 'products'
    ? navigation.go('/products', {}, HOME)
    : section === 'orders'
      ? navigation.go('/orders', {}, ORDERS_HOME)
      : navigation.go('/report');

/** A new tab keeps the settings and the destination's filters. */
export const links = (settings: Settings) => {
  const href: Navigation['href'] = (pattern: string, params: Values = {}, query: Record<string, unknown> = {}) =>
    codec.format(pattern, params, { ...settings, ...query });
  return {
    filtered: (filters: Filters, changes: Partial<Filters>) =>
      href('/products', {}, { ...filters, page: 1, ...changes }),
    href,
    sectionHref: (section: Section) =>
      section === 'products'
        ? href('/products', {}, HOME)
        : section === 'orders'
          ? href('/orders', {}, ORDERS_HOME)
          : href('/report'),
  };
};
