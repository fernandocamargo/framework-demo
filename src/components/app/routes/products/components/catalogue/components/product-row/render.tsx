import { Button, Group, Link } from 'react-aria-components';

import RemoveLink from '@/components/app/routes/products/components/remove-link';

// A product, as schema.org names one: its offer holds the price and the stock, and the commands
// on it are its potential actions.
export default ({
  brand,
  canEdit,
  category,
  change,
  className,
  currency,
  editHref,
  editLabel,
  price,
  rating,
  removeHref,
  stepper,
  stock,
  thumbnail,
  title,
  viewHref,
}) => (
  <li className={className} itemProp="itemListElement" itemScope itemType="https://schema.org/Product">
    {thumbnail && <img alt="" height="56" itemProp="image" loading="lazy" src={thumbnail} width="56" />}
    <hgroup>
      <h3>
        <Link href={viewHref}>
          <span itemProp="name">{title}</span>
        </Link>
        {change && (
          <span itemProp="additionalProperty" itemScope itemType="https://schema.org/PropertyValue">
            <meta content="local" itemProp="propertyID" />
            <data itemProp="value" value={change.value}>
              {change.label}
            </data>
          </span>
        )}
      </h3>
      <p>
        {brand && (
          <span itemProp="brand" itemScope itemType="https://schema.org/Brand">
            <span itemProp="name">{brand}</span>
          </span>
        )}
        {brand && category && ' · '}
        {category && <span itemProp="category">{category}</span>}
      </p>
    </hgroup>
    <div itemProp="offers" itemScope itemType="https://schema.org/Offer">
      <div>
        <link href={stock.availability} itemProp="availability" />
        <data itemProp="inventoryLevel" value={stock.count}>
          {stock.label}
        </data>
        {stepper && (
          <Group aria-busy={stepper.sending || undefined} aria-label={stepper.label}>
            <Button aria-label={stepper.less.label} isDisabled={stepper.less.disabled} onPress={stepper.less.press}>
              −
            </Button>
            <Button aria-label={stepper.more.label} onPress={stepper.more.press}>
              +
            </Button>
          </Group>
        )}
      </div>
      <data itemProp="price" value={price.value}>
        {price.text}
      </data>
      <meta content={currency} itemProp="priceCurrency" />
    </div>
    {rating && (
      <span
        aria-label={rating.label}
        itemProp="aggregateRating"
        itemScope
        itemType="https://schema.org/AggregateRating"
        role="img"
      >
        <data itemProp="ratingValue" value={rating.value}>
          {rating.text}
        </data>
        <meta content="5" itemProp="bestRating" />
      </span>
    )}
    <menu>
      {canEdit && (
        <li>
          <Link href={editHref}>
            <span itemProp="potentialAction" itemScope itemType="https://schema.org/UpdateAction">
              <span itemProp="name">{editLabel}</span>
            </span>
          </Link>
        </li>
      )}
      <li>
        <RemoveLink href={removeHref} title={title} />
      </li>
    </menu>
  </li>
);
