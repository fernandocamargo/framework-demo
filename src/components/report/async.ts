// The report waits for every product as the inventory read answered it, and for the categories'
// names. The framework records what this read: the two services, so a write that makes
// `products.inventory` stale (services/products/meta.ts) reads the report again.
export default async ({ services }) => {
  const [products, categories] = await Promise.all([services.products.inventory(), services.products.categories()]);
  return { asOf: new Date().toISOString(), categories, products };
};
