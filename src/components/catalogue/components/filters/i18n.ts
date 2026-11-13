// The filter bar's words, in English. Translations: i18n/<locale>.json. The sorts are nested by
// field and order, as the address writes them.
export default {
  search: { label: 'Search products', placeholder: 'Search products, then press Enter', clear: 'Clear the search' },
  category: { label: 'Category', all: 'All categories' },
  sort: {
    label: 'Sort',
    title: { asc: 'Title, A to Z' },
    price: { asc: 'Price, low to high', desc: 'Price, high to low' },
    rating: { desc: 'Rating, best first' },
    stock: { asc: 'Stock, lowest first' },
  },
}
