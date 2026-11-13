// The reviews' words, in English. Translations: i18n/<locale>.json.
export default {
  label: 'Reviews',
  heading: '{count, plural, =0 {No reviews yet} one {# review, {average, number, ::.0} on average} other {# reviews, {average, number, ::.0} on average}}',
  rating: '{rating, number} of 5',
  by: '{name}, {on}',
  loading: 'Reading the reviews…',
  failed: { message: 'The reviews could not be read: {message}', retry: 'Try again' },
}
