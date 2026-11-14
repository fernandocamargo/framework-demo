// The map's words, in English. Translations: i18n/<locale>.json.
export default {
  caption:
    'Each order is placed by the state it ships to. DummyJSON’s coordinates are random and its cities do not match its states, so the state is the one field the map trusts.',
  failed: { message: 'The map could not be read: {message}', retry: 'Try again' },
  label: 'Orders by state',
  loading: 'Reading the orders…',
  tile: '{name}, {count, plural, =0 {no orders} one {# order} other {# orders}}',
};
