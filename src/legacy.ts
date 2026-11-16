// Addresses from before the routes: the page in the hash's path, filters and dialogs in its query,
// and the world, the language and the skin in the search (`/?world=memory#/products?edit=4`).
// A bookmark of one opens its new address, once, as the document starts.

import { codec } from './address';

const SECTIONS = ['products', 'report', 'orders'];
const id = (value: null | string) => Number(value);

/** The new address of an old one; null for an address that is not one. */
export function fromLegacy({ hash, pathname, search }: Pick<Location, 'hash' | 'pathname' | 'search'>): null | string {
  const settings = new URLSearchParams(search);
  const [path = '', fields = ''] = hash.split('?');
  const section = SECTIONS.find((each) => path === `#/${each}`);
  const old = section !== undefined || ['lang', 'skin', 'world'].some((key) => settings.has(key));
  if (!old || settings.has('query') || `${pathname.replace(/index\.html$/, '')}` !== codec.base) return null;
  const query = new URLSearchParams(section ? fields : '');
  const [pattern, params] =
    section === 'orders'
      ? query.has('cart')
        ? (['/orders/:id', { id: id(query.get('cart')) }] as const)
        : (['/orders', {}] as const)
      : section === 'report'
        ? (['/report', {}] as const)
        : query.has('edit')
          ? (['/products/:id/edit', { id: id(query.get('edit')) }] as const)
          : query.has('remove')
            ? (['/products/:id/remove', { id: id(query.get('remove')) }] as const)
            : query.has('create')
              ? (['/products/new', {}] as const)
              : query.has('bulk')
                ? (['/products/bulk', {}] as const)
                : query.has('view')
                  ? (['/products/:id', { id: id(query.get('view')) }] as const)
                  : (['/products', {}] as const);
  const values = {
    category: query.get('category'),
    lang: settings.get('lang'),
    order: query.get('order'),
    page: query.has('page') ? Number(query.get('page')) : null,
    q: query.get('q'),
    region: query.get('region'),
    signin: query.has('signin'),
    skin: settings.get('skin'),
    sort: query.get('sort'),
    world: settings.get('world'),
  };
  // The codec keeps the fields the new address declares, and takes the default of one that is not valid.
  const kept = section === undefined ? hash : '';
  try {
    return codec.format(pattern, params, values, kept);
  } catch {
    // A dialog's id that was never one: the page under it.
    return codec.format(section === 'orders' ? '/orders' : '/products', {}, values, kept);
  }
}
