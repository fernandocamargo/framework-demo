export default ({ className, heading, label, reviews }) => (
  <section aria-label={label} className={className}>
    <h3>{heading}</h3>
    <ul>
      {reviews.map((review) => (
        <li key={review.key}>
          <span aria-label={review.rating} className="stars" role="img">
            {review.stars.map((lit, index) => (
              <span className="icon" data-icon="star" data-lit={lit || undefined} key={index} />
            ))}
          </span>
          <p>{review.comment}</p>
          <p className="by">{review.by}</p>
        </li>
      ))}
    </ul>
  </section>
);
