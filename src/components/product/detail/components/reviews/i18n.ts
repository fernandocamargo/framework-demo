// The reviews' words, in English. Translations: i18n/<locale>.json.
export default {
  by: '<author>{name}</author>, <date>{on}</date>',
  failed: { message: 'The reviews could not be read: {message}', retry: 'Try again' },
  heading:
    '{count, plural, =0 {No reviews yet} one {<reviews># review</reviews>, <mean>{average, number, ::.0}</mean> on average} other {<reviews># reviews</reviews>, <mean>{average, number, ::.0}</mean> on average}}',
  label: 'Reviews',
  loading: 'Reading the reviews…',
  rating: '{rating, number} of 5',
};
