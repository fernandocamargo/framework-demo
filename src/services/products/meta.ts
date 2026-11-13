// What the data layer needs to know about the catalogue's operations: which ones read, how
// long an answer that rarely changes stays good, and what each write makes stale. By
// reference: rename an operation and this file follows, or fails to compile.
// A component that read one of these reads again when a write makes it stale. No component
// says so, and no component calls an invalidation.
export default ({ services: { products } }) => ({
  search: { reads: true },
  get: { reads: true },
  reviews: { reads: true, freshFor: 60_000 },
  categories: { reads: true, freshFor: 5 * 60_000 },
  save: { invalidates: [products.search, products.get] },
  create: { invalidates: [products.search] },
  remove: { invalidates: [products.search, products.get] },
  sellOut: { invalidates: [products.search, products.get] },
  reset: { invalidates: [products.search, products.get] },
})
