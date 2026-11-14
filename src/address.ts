// The address, as the route and back. Hash routing, so a static host needs no rewrites:
// `#/products?q=lamp&category=lighting&sort=price&order=desc&page=2&view=12`.
// Fields at their defaults are left out, so the same page always has the same address.

import type { Route } from 'framework';

import type { SortKey } from './services/products/types';

export type Filters = Pick<Route, 'category' | 'order' | 'page' | 'q' | 'sort'>;

export const SORT_KEYS: readonly SortKey[] = ['title', 'price', 'rating', 'stock'];

/** The pages of the app: the first part of the address's path (`#/products`). */
export const SECTIONS = ['products', 'report', 'orders'] as const;
export type Section = (typeof SECTIONS)[number];

// Its order matters: it is the order of the address's fields.
export const HOME: Route = {
  section: 'products',
  q: '',
  category: '',
  sort: 'title',
  order: 'asc',
  page: 1,
  region: '',
  view: null,
  cart: null,
  edit: null,
  create: false,
  remove: null,
  bulk: false,
  signin: false,
};

/** Every dialog closed. */
export const CLOSED = {
  bulk: false,
  cart: null,
  create: false,
  edit: null,
  remove: null,
  signin: false,
  view: null,
} satisfies Partial<Route>;

const id = (value: null | string) => {
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number > 0 ? number : null;
};

export function parse(hash: string): Route {
  const query = new URLSearchParams(hash.split('?')[1] ?? '');
  const sort = query.get('sort') as SortKey;
  const path = hash.replace(/\?.*$/, '').replace(/^#\//, '');
  const region = query.get('region') ?? '';
  return {
    bulk: query.has('bulk'),
    cart: id(query.get('cart')),
    category: query.get('category') ?? '',
    create: query.has('create'),
    edit: id(query.get('edit')),
    order: query.get('order') === 'desc' ? 'desc' : 'asc',
    page: id(query.get('page')) ?? 1,
    q: query.get('q') ?? '',
    region: /^[A-Z]{0,2}$/.test(region) ? region : '',
    remove: id(query.get('remove')),
    section: SECTIONS.find((section) => section === path) ?? HOME.section,
    signin: query.has('signin'),
    sort: SORT_KEYS.includes(sort) ? sort : HOME.sort,
    view: id(query.get('view')),
  };
}

export function format(route: Route): string {
  const query = new URLSearchParams();
  for (const key of Object.keys(HOME) as (keyof Route)[]) {
    const value = route[key];
    if (key === 'section' || value === HOME[key] || value === null || value === false) continue;
    query.set(key, value === true ? '1' : String(value));
  }
  const text = query.toString();
  return text ? `#/${route.section}?${text}` : `#/${route.section}`;
}

/** The address of a page with its filters and dialogs closed. */
export const sectionHref = (section: Section) => format({ ...HOME, section });

/** The address of these filters with `changes` on top, and every dialog closed unless `changes` opens one. */
export const href = (filters: Filters, changes: Partial<Route> = {}) => format({ ...HOME, ...filters, ...changes });

/** The address of the same list filtered another way: it starts again at page 1. */
export const filtered = (filters: Filters, changes: Partial<Filters>) => href(filters, { page: 1, ...changes });

/** Changes these fields of the address and keeps the others. What `navigation.go` does. */
export const go = (changes: Partial<Route>) => {
  window.location.hash = format({ ...parse(window.location.hash), ...changes });
};
