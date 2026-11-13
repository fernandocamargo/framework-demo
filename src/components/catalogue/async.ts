// The catalogue waits for its page of products before it shows. The framework records what
// this read: the two services and these five route fields. So another filter, sort or page in
// the address is another read; a dialog opening is not; and a write that makes
// `products.search` stale (services/products/meta.ts) reads the page on screen again.
export default async ({ services, route }) => {
  const filters = { q: route.q, category: route.category, sort: route.sort, order: route.order, page: route.page }
  const [page, categories] = await Promise.all([services.products.search(filters), services.products.categories()])
  return { filters, page, categories }
}
