// The orders the map counts. It reads them whatever the state on screen, so a change of state is
// no read of its own: the ledger's read is the same one, and is kept.
// The map's basemap style is read beside them, for the live map when its flag is on.
export default async ({ services }) => {
  const [orders, style] = await Promise.all([services.orders.list(), services.maps.style()]);
  return { orders, style };
};
