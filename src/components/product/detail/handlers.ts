import { go } from '@/address';

// Editing a product opens the editor over the same address, with this dialog closed.
export const editProduct =
  ({ async: { default: product } }) =>
  () =>
    go({ edit: product.id, view: null });
