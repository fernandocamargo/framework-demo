import { Link } from 'react-aria-components'

export default ({ className, title, thumbnail, origin, price, rated, rating, stock, change, viewHref, editHref, editLabel, removeHref, removeLabel }) => (
  <li className={className}>
    {thumbnail ? <img src={thumbnail} alt="" width="56" height="56" loading="lazy" /> : <span className="no-picture" aria-hidden="true" />}
    <div className="name">
      <Link href={viewHref}>{title}</Link>
      {change && (
        <span className="badge" data-tone="accent">
          {change}
        </span>
      )}
      <p>{origin}</p>
    </div>
    <span className="badge" data-tone={stock.tone}>
      {stock.label}
    </span>
    <span className="rating">
      {rating && (
        <>
          <span className="icon" data-icon="star" />
          <span className="visually-hidden">{rated} </span>
          {rating}
        </>
      )}
    </span>
    <strong className="price">{price}</strong>
    <div className="actions">
      <Link href={editHref} data-variant="icon" aria-label={editLabel}>
        <span className="icon" data-icon="edit" />
      </Link>
      <Link href={removeHref} data-variant="icon" aria-label={removeLabel}>
        <span className="icon" data-icon="trash" />
      </Link>
    </div>
  </li>
)
