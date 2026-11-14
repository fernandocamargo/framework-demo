// The report's words, in English. Translations: i18n/<locale>.json. The headline and the deck are
// sentences written from the figures: a select says which lead it is, a plural counts.
export default {
  deck: '{kind, select, out {{units, number} units on the shelves, worth {value}. {low, plural, =0 {Nothing else is running low.} one {# more is running low.} other {# more are running low.}}} low {{units, number} units on the shelves, worth {value}. {out, plural, =0 {Nothing is out of stock.} one {# is out of stock.} other {# are out of stock.}}} other {{units, number} units on the shelves, worth {value}.}}',
  failed: { message: 'The report could not be read: {message}', retry: 'Try again' },
  figures: { low: 'Running low', out: 'Out of stock', products: 'Products', units: 'Units', value: 'Value' },
  headline:
    '{kind, select, out {{count, plural, one {# product is out of stock} other {# products are out of stock}}} low {{category} runs short: {count, plural, one {# product at {limit, number} units or fewer} other {# products at {limit, number} units or fewer}}} other {Every product is above {limit, number} units}}',
  loading: 'Reading the report…',
  shortest: { label: 'The products closest to running out', title: 'Closest to running out' },
  stock: '{level, select, out {Out of stock} low {Low: {count, number} left} other {{count, number} in stock}}',
  table: {
    caption: 'Stock by category',
    category: 'Category',
    offers: 'Products',
    prices: 'Prices',
    units: 'Units',
    value: 'Value',
  },
  title: 'Report',
};
