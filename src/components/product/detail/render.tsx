import { Button, Dialog, Heading } from 'react-aria-components';

import { go } from '@/address';
import RemoveLink from '@/components/product/remove-link';

import Reviews from './components/reviews';

export default ({
  canEdit,
  change,
  className,
  description,
  i18n,
  id,
  images,
  origin,
  price,
  removeHref,
  stock,
  title,
}) => (
  <Dialog className={`react-aria-Dialog ${className}`}>
    <header>
      <div>
        <Heading slot="title">{title}</Heading>
        <p className="origin">{origin}</p>
      </div>
      <Button aria-label={i18n.close} data-variant="icon" onPress={() => go({ view: null })}>
        <span className="icon" data-icon="close" />
      </Button>
    </header>
    {images.length > 0 && (
      <ul aria-label={i18n.pictures.label} className="pictures" tabIndex={0}>
        {images.map((image) => (
          <li key={image.src}>
            <img alt={image.alt} loading="lazy" src={image.src} />
          </li>
        ))}
      </ul>
    )}
    <div className="facts">
      <strong className="price">{price}</strong>
      <span className="badge" data-tone={stock.tone}>
        {stock.label}
      </span>
      {change && (
        <span className="badge" data-tone="accent">
          {change}
        </span>
      )}
    </div>
    <p>{description}</p>
    <Reviews />
    <footer>
      <RemoveLink href={removeHref} title={title} variant="text" />
      {canEdit && (
        <Button data-variant="primary" onPress={() => go({ edit: id, view: null })}>
          {i18n.actions.edit}
        </Button>
      )}
    </footer>
  </Dialog>
);
