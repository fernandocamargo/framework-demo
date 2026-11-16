// The reviews, in the locale on screen: their count and average in one plural message, and each
// date as the locale writes it. The messages mark which of their words are which value, so the
// render can name each as schema.org does.
import type { ReactNode } from 'react';

type Part = (chunks: ReactNode[]) => ReactNode;

export default ({ async: { default: reviews }, i18n, intl }) => {
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  return {
    average,
    count: reviews.length,
    /** The count and the average, with what marks each: `heading(count, average)`. */
    heading: (count: Part, mean: Part) => i18n.heading({ average, count: reviews.length, mean, reviews: count }),
    label: i18n.label,
    rated: reviews.length > 0,
    reviews: reviews.map((review) => ({
      /** The reviewer and the date, with what marks each: `by(author, date)`. */
      by: (author: Part, date: Part) =>
        i18n.by({
          author,
          date,
          name: review.reviewerName,
          on: intl.formatDate(review.date, { dateStyle: 'medium', timeZone: 'UTC' }),
        }),
      comment: review.comment,
      date: review.date,
      key: `${review.reviewerName}:${review.date}`,
      rating: { label: i18n.rating({ rating: review.rating }), value: review.rating },
    })),
  };
};

/** The address each story Storybook shows of this folder needs (framework/storybook). */
export const examples = {
  "A product's reviews": { route: { view: 22 } },
};
