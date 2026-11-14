import { Button, Group, Link } from 'react-aria-components';

import RemoveLink from '@/components/product/remove-link';

export default ({
  canEdit,
  change,
  className,
  editHref,
  editLabel,
  origin,
  price,
  rated,
  rating,
  removeHref,
  stepper,
  stock,
  thumbnail,
  title,
  viewHref,
}) => (
  <li className={className}>
    {thumbnail ? (
      <img alt="" height="56" loading="lazy" src={thumbnail} width="56" />
    ) : (
      <span aria-hidden="true" className="no-picture" />
    )}
    <div className="name">
      <Link href={viewHref}>{title}</Link>
      {change && (
        <span className="badge" data-tone="accent">
          {change}
        </span>
      )}
      <p>{origin}</p>
    </div>
    <div className="stock">
      <span className="badge" data-tone={stock.tone}>
        {stock.label}
      </span>
      {stepper && (
        <Group aria-label={stepper.label} data-sending={stepper.sending || undefined}>
          <Button
            aria-label={stepper.less.label}
            data-variant="icon"
            isDisabled={stepper.less.disabled}
            onPress={stepper.less.press}
          >
            −
          </Button>
          <Button aria-label={stepper.more.label} data-variant="icon" onPress={stepper.more.press}>
            +
          </Button>
        </Group>
      )}
    </div>
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
        <Link aria-label={editLabel} data-variant="icon" href={editHref}>
          <span className="icon" data-icon="edit" />
        </Link>
      )}
      <RemoveLink href={removeHref} title={title} variant="icon" />
    </div>
  </li>
);
