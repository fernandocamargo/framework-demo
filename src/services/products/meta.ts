// What the data layer needs to know about the catalogue's operations: which ones read, how
// long an answer that rarely changes stays good, what each write makes stale, and how some
// writes change what is shown before the server answers. By reference: rename an operation and
// this file follows, or fails to compile.
// A component that read one of these reads again when a write makes it stale. No component
// says so, and no component calls an invalidation.
import { update } from 'framework'
import type { Listed, Page } from './types'

/** A product as the overlay will keep it: changed here, one version on. What the server will answer, so nothing renders twice. */
const edited = <T extends Listed>(product: T, changes: Partial<Listed>): T => ({ ...product, ...changes, version: product.version + 1, local: product.local ?? 'edited' })

/** A list with one product changed, or the same list. */
const changed = (page: Page, id: number, changes: Partial<Listed>): Page =>
  page.items.some((item) => item.id === id) ? { ...page, items: page.items.map((item) => (item.id === id ? edited(item, changes) : item)) } : page

export default ({ services: { products } }) => ({
  search: { reads: true },
  get: { reads: true },
  reviews: { reads: true, freshFor: 60_000 },
  categories: { reads: true, freshFor: 5 * 60_000 },
  // A save shows at once in the list and in the product's dialog; a conflict or a failure takes it out.
  save: {
    invalidates: [products.search, products.get],
    optimistic: [
      update(products.search, (page, { id, changes }) => changed(page, id, changes)),
      update(products.get, (product, { id, changes }) => (product.id === id ? edited(product, changes) : product)),
    ],
  },
  setStock: {
    invalidates: [products.search, products.get],
    optimistic: [
      update(products.search, (page, { id, stock }) => changed(page, id, { stock })),
      update(products.get, (product, { id, stock }) => (product.id === id ? edited(product, { stock }) : product)),
    ],
  },
  create: { invalidates: [products.search] },
  // A deletion leaves the list at once.
  remove: {
    invalidates: [products.search, products.get],
    optimistic: [
      update(products.search, (page, id) =>
        page.items.some((item) => item.id === id) ? { ...page, items: page.items.filter((item) => item.id !== id), total: page.total - 1 } : page,
      ),
    ],
  },
  sellOut: { invalidates: [products.search, products.get] },
  reset: { invalidates: [products.search, products.get] },
})
