// The filter bar's words, in English. Translations: i18n/<locale>.json. The sorts are nested by
// field and order, as the address writes them.
export default {
  category: { all: 'All categories', label: 'Category' },
  search: { clear: 'Clear the search', label: 'Search products', placeholder: 'Search products, then press Enter' },
  sort: {
    label: 'Sort',
    price: { asc: 'Price, low to high', desc: 'Price, high to low' },
    rating: { desc: 'Rating, best first' },
    stock: { asc: 'Stock, lowest first' },
    title: { asc: 'Title, A to Z' },
  },
};
