// The app names its pages and convenient list links. Matching and History are the router's; the
// query codec and the navigation types are generated.
import type { ComponentType } from 'react';
import { createBrowserRouter, type DataRouter, type LoaderFunction } from 'react-router';
import codec, { createAddress } from 'virtual:framework/address';
import routes from 'virtual:framework/routes';

import type { AddressSnapshot, Navigation, Route, RouterAddress, Values } from 'framework';

/** The shell's development pages, in the hash: `#/states`, the gallery, and `#/states/<path>/<state>`, a frame of it. */
export const STATES = '#/states';
/** The document's router and its address. The shell is the root route, so it starts them (`start`). */
export let router: DataRouter;
export let address: RouterAddress;
export let navigation: Navigation;
/**
 * Creates the router with the shell as its root route. Every route folder is a child of it; an
 * address no folder names matches the last child, and the address store sends it home. The
 * shell's `loader` runs with those of the folders an address matches, before the address shows.
 * A test gives another router than the browser's (`create`).
 */
const Nothing = () => null;
export const start = (
  Shell: ComponentType,
  loader?: LoaderFunction,
  create: typeof createBrowserRouter = createBrowserRouter,
) => {
  router = create(
    [
      {
        children: [...routes, { id: 'unknown', path: '*' }],
        Component: Shell,
        // Nothing shows until the first address's folders are loaded, as before the shell's first render.
        HydrateFallback: Nothing,
        id: 'shell',
        ...(loader ? { loader } : {}),
        path: '/',
      },
    ],
    { basename: codec.base },
  );
  address = createAddress(router, { hashes: (hash) => hash === STATES || hash.startsWith(`${STATES}/`) });
  navigation = address.navigation as Navigation;
  return router;
};
export const go: Navigation['go'] = (...given: unknown[]) => (navigation.go as (...all: unknown[]) => void)(...given);
export const query: Navigation['query'] = (...given: unknown[]) =>
  (navigation.query as (...all: unknown[]) => void)(...given);
/** What react-aria's links do when pressed: they keep the click to themselves, so the document never sees it. */
export const follow = (href: string) => {
  if (!address.open(href)) window.location.assign(href);
};
/** Opens a page with its own fields at their defaults. */
export const openSection = (section: Section) =>
  section === 'products'
    ? go('/products', {}, HOME)
    : section === 'orders'
      ? go('/orders', {}, ORDERS_HOME)
      : go('/report');
/** Whether two addresses show the same page: they differ at most in the language and the skin. */
export const samePage = (one: AddressSnapshot, other: AddressSnapshot) =>
  one.href === other.href ||
  codec.format(
    one.pattern,
    one.params,
    { ...one.query, lang: other.query['lang'], skin: other.query['skin'] },
    one.hash,
  ) === other.href;
/** Changes shell fields where the address is, adding no entry: Back does not undo a skin or a language. */
export const inPlace = (changes: Partial<Pick<Route, 'lang' | 'skin'>>) => {
  const { hash, params, pattern, query: fields } = address.latest();
  address.replace(codec.format(pattern, params, { ...fields, ...changes }, hash));
};
export { codec };
export type Filters = Pick<Route, 'category' | 'order' | 'page' | 'q' | 'sort'>;
export const HOME: Filters = { category: '', order: 'asc', page: 1, q: '', sort: 'title' };
export const ORDERS_HOME = { page: 1, region: '' };
export const SECTIONS = ['products', 'report', 'orders'] as const;
export type Section = (typeof SECTIONS)[number];
/** Link writers read these route fields, so a new tab keeps the settings on screen. */
export const links = (route: Pick<Route, 'lang' | 'signin' | 'skin' | 'world'>) => {
  const shell = { lang: route.lang, signin: route.signin, skin: route.skin, world: route.world };
  const href: Navigation['href'] = (pattern: string, params: Values = {}, query: Record<string, unknown> = {}) =>
    address.navigation.href(pattern, params, { ...shell, ...query });
  return {
    filtered: (filters: Filters, changes: Partial<Filters>) =>
      href('/products', {}, { ...filters, page: 1, ...changes }),
    href,
    // A page's link opens it with its own fields at their defaults, also from that page.
    sectionHref: (section: Section) =>
      section === 'products'
        ? href('/products', {}, HOME)
        : section === 'orders'
          ? href('/orders', {}, ORDERS_HOME)
          : href('/report'),
  };
};
