// The reviews, in the locale on screen: their count and average in one plural message, and each
// date as the locale writes it.
export default ({ i18n, intl, async: { default: reviews } }) => ({
  label: i18n.label,
  heading: i18n.heading({ count: reviews.length, average: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0 }),
  reviews: reviews.map((review) => ({
    key: `${review.reviewerName}:${review.date}`,
    by: i18n.by({ name: review.reviewerName, on: intl.formatDate(review.date, { dateStyle: 'medium', timeZone: 'UTC' }) }),
    rating: i18n.rating({ rating: review.rating }),
    stars: [1, 2, 3, 4, 5].map((star) => star <= review.rating),
    comment: review.comment,
  })),
})
