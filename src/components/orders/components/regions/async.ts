// The orders the map counts. It reads them whatever the state on screen, so a change of state is
// no read of its own: the ledger's read is the same one, and is kept.
export default ({ services }) => services.orders.list();
