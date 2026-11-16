import { Button, Dialog } from 'react-aria-components';

import RemoveLink from '@/components/app/routes/products/components/remove-link';

import Reviews from './components/reviews';

// The product, as schema.org names one; its reviews (a child component) are its own.
export default ({
  brand,
  canEdit,
  category,
  change,
  className,
  currency,
  description,
  handlers,
  i18n,
  id,
  images,
  price,
  removeHref,
  stock,
  title,
}) => (
  <Dialog aria-label={title} className={`react-aria-Dialog ${className}`}>
    <article itemScope itemType="https://schema.org/Product">
      <header>
        <hgroup>
          <h2>
            <span itemProp="name">{title}</span>
          </h2>
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
        <Button slot="close">{i18n.close}</Button>
      </header>
      {images.length > 0 && (
        <ul aria-label={i18n.pictures.label} tabIndex={0}>
          {images.map((image) => (
            <li key={image.src}>
              <img alt={image.alt} itemProp="image" loading="lazy" src={image.src} />
            </li>
          ))}
        </ul>
      )}
      <p itemProp="offers" itemScope itemType="https://schema.org/Offer">
        <data itemProp="price" value={price.value}>
          {price.text}
        </data>
        <meta content={currency} itemProp="priceCurrency" />
        <link href={stock.availability} itemProp="availability" />
        <data itemProp="inventoryLevel" value={stock.count}>
          {stock.label}
        </data>
        {change && (
          <span itemProp="additionalProperty" itemScope itemType="https://schema.org/PropertyValue">
            <meta content="local" itemProp="propertyID" />
            <data itemProp="value" value={change.value}>
              {change.label}
            </data>
          </span>
        )}
      </p>
      <p itemProp="description">{description}</p>
      <Reviews id={id} />
      <footer>
        <RemoveLink href={removeHref} title={title} />
        {canEdit && (
          <Button onPress={handlers.editProduct}>
            <span itemProp="potentialAction" itemScope itemType="https://schema.org/UpdateAction">
              <span itemProp="name">{i18n.actions.edit}</span>
            </span>
          </Button>
        )}
      </footer>
    </article>
  </Dialog>
);
