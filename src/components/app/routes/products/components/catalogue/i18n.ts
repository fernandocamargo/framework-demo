// The catalogue's words, in English. Translations: i18n/<locale>.json.
export default {
  actions: { bulk: 'Bulk price change', create: 'New product' },
  empty: { clear: 'Clear the filters', narrowed: 'No product matches these filters.', none: 'The catalogue is empty.' },
  failed: { message: 'The catalogue could not be read: {message}', retry: 'Try again' },
  keys: {
    bulk: 'Bulk price change',
    create: 'New product',
    next: 'Next page',
    previous: 'Previous page',
    search: 'Search the catalogue',
  },
  list: 'Products',
  loading: 'Reading the catalogue…',
  paging: { label: 'Pages', next: 'Next', page: 'Page {page, number} of {pages, number}', previous: 'Previous' },
  readOnly: 'You can browse the catalogue. Changing it needs a permission you do not have.',
  // One message for every summary: a plural for the count, a select for the filters on.
  summary:
    '<total>{count, plural, one {# product} other {# products}}</total>{filter, select, q { matching “{q}”} category { in {category}} both { matching “{q}” in {category}} other {}}',
  title: 'Products',
};
