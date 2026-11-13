// The editor's words, in English. Translations: i18n/<locale>.json.
export default {
  heading: { create: 'New product', edit: 'Edit {title}', untitled: 'Edit product' },
  close: 'Close',
  readOnly: 'You can see this product. Changing it needs a permission you do not have.',
  loading: 'Reading the product',
  unavailable: { message: 'The product could not be read: {message}', retry: 'Try again' },
  fields: { title: 'Title', description: 'Description', category: 'Category', brand: 'Brand', price: 'Price', stock: 'Stock', choose: 'Choose one' },
  problems: {
    title: 'A product needs a title.',
    category: 'Choose a category.',
    price: 'The price must be more than zero.',
    stock: 'The stock cannot be negative.',
  },
  conflict: {
    message: 'Somebody else changed this product while you were editing it. Your changes are still here.',
    theirs: 'Discard mine and reload',
    mine: 'Save mine anyway',
  },
  failed: { message: 'It was not saved: {message}', back: 'Back to the form', retry: 'Try again' },
  cancel: 'Cancel',
  save: { create: 'Create product', edit: 'Save changes' },
  discard: { title: 'Discard your changes?', text: 'What you changed in this product has not been saved.', keep: 'Keep editing', discard: 'Discard' },
  keys: { save: 'Save the product' },
}
