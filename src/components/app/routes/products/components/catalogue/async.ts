// The catalogue waits for its page of products before it shows. The framework records what
// this read: the two services and these five route fields. So another filter, sort or page in
// the address is another read; a dialog opening is not; and a write that makes
// `products.search` stale (services/products/meta.ts) reads the page on screen again.
export default async ({ route, services }) => {
  const filters = { category: route.category, order: route.order, page: route.page, q: route.q, sort: route.sort };
  const [page, categories] = await Promise.all([services.products.search(filters), services.products.categories()]);
  return { categories, filters, page };
};
