export default ({ className, heading, reviews }) => (
  <section className={className} aria-label="Reviews">
    <h3>{heading}</h3>
    <ul>
      {reviews.map((review) => (
        <li key={review.key}>
          <span className="stars" role="img" aria-label={review.rating}>
            {review.stars.map((lit, index) => (
              <span key={index} className="icon" data-icon="star" data-lit={lit || undefined} />
            ))}
          </span>
          <p>{review.comment}</p>
          <p className="by">
            {review.by}, {review.on}
          </p>
        </li>
      ))}
    </ul>
  </section>
)
