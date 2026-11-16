// The product's aggregate rating and its reviews, as schema.org names them. The section is the
// product's: inside the product's dialog, each review is one of its properties.
export default ({ average, className, count, heading, label, rated, reviews }) => (
  <section aria-label={label} className={className}>
    <h3
      itemProp={rated ? 'aggregateRating' : undefined}
      itemScope={rated || undefined}
      itemType={rated ? 'https://schema.org/AggregateRating' : undefined}
    >
      {heading(
        (chunks) => (
          <data itemProp="reviewCount" value={count}>
            {chunks}
          </data>
        ),
        (chunks) => (
          <data itemProp="ratingValue" value={average}>
            {chunks}
          </data>
        ),
      )}
      {rated && <meta content="5" itemProp="bestRating" />}
    </h3>
    <ul>
      {reviews.map((review) => (
        <li itemProp="review" itemScope itemType="https://schema.org/Review" key={review.key}>
          <span itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
            <meter aria-label={review.rating.label} itemProp="ratingValue" max={5} min={0} value={review.rating.value}>
              {review.rating.label}
            </meter>
            <meta content="5" itemProp="bestRating" />
          </span>
          <p itemProp="reviewBody">{review.comment}</p>
          <p>
            {review.by(
              (chunks) => (
                <span itemProp="author" itemScope itemType="https://schema.org/Person">
                  <span itemProp="name">{chunks}</span>
                </span>
              ),
              (chunks) => (
                <time dateTime={review.date} itemProp="datePublished">
                  {chunks}
                </time>
              ),
            )}
          </p>
        </li>
      ))}
    </ul>
  </section>
);
