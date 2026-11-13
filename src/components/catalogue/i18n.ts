// The catalogue's words, in English. Translations: i18n/<locale>.json.
export default {
  title: 'Products',
  // One message for every summary: a plural for the count, a select for the filters on.
  summary:
    '{count, plural, one {# product} other {# products}}{filter, select, q { matching “{q}”} category { in {category}} both { matching “{q}” in {category}} other {}}',
  actions: { bulk: 'Bulk price change', create: 'New product' },
  readOnly: 'You can browse the catalogue. Changing it needs a permission you do not have.',
  list: 'Products',
  empty: { narrowed: 'No product matches these filters.', none: 'The catalogue is empty.', clear: 'Clear the filters' },
  paging: { label: 'Pages', previous: 'Previous', next: 'Next', page: 'Page {page, number} of {pages, number}' },
  loading: 'Reading the catalogue…',
  failed: { message: 'The catalogue could not be read: {message}', retry: 'Try again' },
  keys: { search: 'Search the catalogue', create: 'New product', bulk: 'Bulk price change', previous: 'Previous page', next: 'Next page' },
}
