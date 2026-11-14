// The ledger's words, in English. Translations: i18n/<locale>.json.
export default {
  empty: { none: 'There are no orders.', region: 'No order ships to {name}.' },
  failed: { message: 'The orders could not be read: {message}', retry: 'Try again' },
  items: '{count, plural, one {# item} other {# items}}',
  label: 'Order ledger',
  list: 'Orders',
  loading: 'Reading the orders…',
  number: 'Order {number}',
  paging: { label: 'Pages', next: 'Next', page: 'Page {page, number} of {pages, number}', previous: 'Previous' },
  // One message for every summary: a plural for the count, a select for the state it is about.
  summary: '{count, plural, one {# order} other {# orders}}{scope, select, all {} other { to {name}}}',
};
