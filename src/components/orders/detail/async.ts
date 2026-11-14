// The order the address names (`cart`). Keyed by that field alone: the state on screen can change
// behind the dialog without this reading again.
export default ({ route, services }) => services.orders.get(route.cart ?? 0);
