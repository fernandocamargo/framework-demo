// The address, as the route and back. Hash routing, so a static host needs no rewrites:
// `#/products?q=lamp&category=lighting&sort=price&order=desc&page=2&view=12`.
// Fields at their defaults are left out, so the same page always has the same address.

import type { Route } from 'framework'
import type { SortKey } from './services/products/types'

export type Filters = Pick<Route, 'q' | 'category' | 'sort' | 'order' | 'page'>

export const SORT_KEYS: readonly SortKey[] = ['title', 'price', 'rating', 'stock']

// Its order matters: it is the order of the address's fields.
export const HOME: Route = {
  q: '',
  category: '',
  sort: 'title',
  order: 'asc',
  page: 1,
  view: null,
  edit: null,
  create: false,
  remove: null,
  bulk: false,
  signin: false,
}

/** Every dialog closed. */
export const CLOSED = { view: null, edit: null, create: false, remove: null, bulk: false, signin: false } satisfies Partial<Route>

const id = (value: string | null) => {
  const number = Number(value)
  return value !== null && Number.isInteger(number) && number > 0 ? number : null
}

export function parse(hash: string): Route {
  const query = new URLSearchParams(hash.split('?')[1] ?? '')
  const sort = query.get('sort') as SortKey
  return {
    q: query.get('q') ?? '',
    category: query.get('category') ?? '',
    sort: SORT_KEYS.includes(sort) ? sort : HOME.sort,
    order: query.get('order') === 'desc' ? 'desc' : 'asc',
    page: id(query.get('page')) ?? 1,
    view: id(query.get('view')),
    edit: id(query.get('edit')),
    create: query.has('create'),
    remove: id(query.get('remove')),
    bulk: query.has('bulk'),
    signin: query.has('signin'),
  }
}

export function format(route: Route): string {
  const query = new URLSearchParams()
  for (const key of Object.keys(HOME) as (keyof Route)[]) {
    const value = route[key]
    if (value === HOME[key] || value === null || value === false) continue
    query.set(key, value === true ? '1' : String(value))
  }
  const text = query.toString()
  return text ? `#/products?${text}` : '#/products'
}

/** The address of these filters with `changes` on top, and every dialog closed unless `changes` opens one. */
export const href = (filters: Filters, changes: Partial<Route> = {}) => format({ ...HOME, ...filters, ...changes })

/** The address of the same list filtered another way: it starts again at page 1. */
export const filtered = (filters: Filters, changes: Partial<Filters>) => href(filters, { page: 1, ...changes })

/** Changes these fields of the address and keeps the others. What `navigation.go` does. */
export const go = (changes: Partial<Route>) => {
  window.location.hash = format({ ...parse(window.location.hash), ...changes })
}
