// The orders of the state on screen, and the page on screen. Keyed by those two address fields, so
// a state or a page is a read of its own; a dialog opening is not.
export default async ({ route, services }) => ({
  orders: await services.orders.list(),
  page: route.page,
  region: route.region,
});
