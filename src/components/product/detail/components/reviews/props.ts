import { date, plural } from '@/format'

export default ({ async: { default: reviews } }) => ({
  heading: reviews.length ? `${plural(reviews.length, 'review')}, ${(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)} on average` : 'No reviews yet',
  reviews: reviews.map((review) => ({
    key: `${review.reviewerName}:${review.date}`,
    by: review.reviewerName,
    on: date(review.date),
    rating: `${review.rating} of 5`,
    stars: [1, 2, 3, 4, 5].map((star) => star <= review.rating),
    comment: review.comment,
  })),
})
