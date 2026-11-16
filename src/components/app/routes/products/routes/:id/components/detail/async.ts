// The product the address names (`view`). Keyed by that field alone: the filters behind the
// dialog can change without this reading again.
export default ({ id, services }) => services.products.get(id);
