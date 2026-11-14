// The reviews, in the locale on screen: their count and average in one plural message, and each
// date as the locale writes it.
export default ({ async: { default: reviews }, i18n, intl }) => ({
  heading: i18n.heading({
    average: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0,
    count: reviews.length,
  }),
  label: i18n.label,
  reviews: reviews.map((review) => ({
    by: i18n.by({
      name: review.reviewerName,
      on: intl.formatDate(review.date, { dateStyle: 'medium', timeZone: 'UTC' }),
    }),
    comment: review.comment,
    key: `${review.reviewerName}:${review.date}`,
    rating: i18n.rating({ rating: review.rating }),
    stars: [1, 2, 3, 4, 5].map((star) => star <= review.rating),
  })),
});

/** The address each story Storybook shows of this folder needs (framework/storybook). */
export const examples = {
  "A product's reviews": { route: { view: 22 } },
};
