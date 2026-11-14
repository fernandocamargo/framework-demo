// What the data layer needs to know about the catalogue's operations: which ones read, how
// long an answer that rarely changes stays good, what each write makes stale, and how some
// writes change what is shown before the server answers. By reference: rename an operation and
// this file follows, or fails to compile.
// A component that read one of these reads again when a write makes it stale. No component
// says so, and no component calls an invalidation.

import { update } from 'framework';

import type { Listed, Page } from './types';

/** A product as the overlay will keep it: changed here, one version on. What the server will answer, so nothing renders twice. */
const edited = <T extends Listed>(product: T, changes: Partial<Listed>): T => ({
  ...product,
  ...changes,
  local: product.local ?? 'edited',
  version: product.version + 1,
});

/** A list with one product changed, or the same list. */
const changed = (page: Page, id: number, changes: Partial<Listed>): Page =>
  page.items.some((item) => item.id === id)
    ? { ...page, items: page.items.map((item) => (item.id === id ? edited(item, changes) : item)) }
    : page;

// The reads lay the local overlay over DummyJSON's answers; in another tab, they follow the
// overlay the tabs share, once its change can be read there.
export default ({ clients: { local }, services: { products } }) => ({
  categories: { freshFor: 5 * 60_000, reads: true },
  create: { invalidates: [products.search] },
  get: { follows: (stale) => local.changed(stale), reads: true },
  // A deletion leaves the list at once.
  remove: {
    invalidates: [products.search, products.get],
    optimistic: [
      update(products.search, (page, id) =>
        page.items.some((item) => item.id === id)
          ? { ...page, items: page.items.filter((item) => item.id !== id), total: page.total - 1 }
          : page,
      ),
    ],
  },
  reset: { invalidates: [products.search, products.get] },
  reviews: { freshFor: 60_000, reads: true },
  // A save shows at once in the list and in the product's dialog; a conflict or a failure takes it out.
  save: {
    invalidates: [products.search, products.get],
    optimistic: [
      update(products.search, (page, { changes, id }) => changed(page, id, changes)),
      update(products.get, (product, { changes, id }) => (product.id === id ? edited(product, changes) : product)),
    ],
  },
  search: { follows: (stale) => local.changed(stale), reads: true },
  sellOut: { invalidates: [products.search, products.get] },
  setStock: {
    invalidates: [products.search, products.get],
    optimistic: [
      update(products.search, (page, { id, stock }) => changed(page, id, { stock })),
      update(products.get, (product, { id, stock }) => (product.id === id ? edited(product, { stock }) : product)),
    ],
  },
});
