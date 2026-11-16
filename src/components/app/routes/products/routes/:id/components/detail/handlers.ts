// Editing a product opens the editor over the same address, with this dialog closed.
export const editProduct =
  ({ async: { default: product }, navigation }) =>
  () =>
    navigation.go('/products/:id/edit', { id: product.id });
