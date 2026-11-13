import { Link } from 'react-aria-components'
import RemoveLink from '@/components/product/remove-link'

export default ({ className, title, thumbnail, origin, price, rated, rating, stock, change, viewHref, canEdit, editHref, editLabel, removeHref }) => (
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
      {canEdit && (
        <Link href={editHref} data-variant="icon" aria-label={editLabel}>
          <span className="icon" data-icon="edit" />
        </Link>
      )}
      <RemoveLink href={removeHref} title={title} variant="icon" />
    </div>
  </li>
)
