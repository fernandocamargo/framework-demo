// The row's own write: the stock, one unit at a time. The data layer shows it at once
// (services/products/meta.ts), and takes it out if the server refuses it.
export const setStock =
  ({ services }) =>
  (id: number, stock: number) =>
    services.products.setStock({ id, stock });
