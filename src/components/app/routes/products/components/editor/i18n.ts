// The editor's words, in English. Translations: i18n/<locale>.json.
export default {
  cancel: 'Cancel',
  close: 'Close',
  conflict: {
    message: 'Somebody else changed this product while you were editing it. Your changes are still here.',
    mine: 'Save mine anyway',
    theirs: 'Discard mine and reload',
  },
  discard: {
    discard: 'Discard',
    keep: 'Keep editing',
    text: 'What you changed in this product has not been saved.',
    title: 'Discard your changes?',
  },
  failed: { back: 'Back to the form', message: 'It was not saved: {message}', retry: 'Try again' },
  fields: {
    brand: 'Brand',
    category: 'Category',
    choose: 'Choose one',
    description: 'Description',
    price: 'Price',
    stock: 'Stock',
    title: 'Title',
  },
  heading: { create: 'New product', edit: 'Edit {title}', untitled: 'Edit product' },
  keys: { save: 'Save the product' },
  loading: 'Reading the product',
  problems: {
    category: 'Choose a category.',
    price: 'The price must be more than zero.',
    stock: 'The stock cannot be negative.',
    title: 'A product needs a title.',
  },
  readOnly: 'You can see this product. Changing it needs a permission you do not have.',
  save: { create: 'Create product', edit: 'Save changes' },
  unavailable: { message: 'The product could not be read: {message}', retry: 'Try again' },
};
