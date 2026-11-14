// Somebody else's save of the product being edited: its last unit sells. The editor's next save is
// a conflict. It reads the address when pressed.
export const sellOut = ({ route, services }) =>
  route.edit === null ? Promise.resolve() : services.products.sellOut(route.edit);
