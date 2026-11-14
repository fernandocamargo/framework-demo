import { Button, Dialog, Heading } from 'react-aria-components'
import { go } from '@/address'
import RemoveLink from '@/components/product/remove-link'
import Reviews from './components/reviews'

export default ({ className, i18n, id, title, description, origin, price, stock, images, change, canEdit, removeHref }) => (
  <Dialog className={`react-aria-Dialog ${className}`}>
    <header>
      <div>
        <Heading slot="title">{title}</Heading>
        <p className="origin">{origin}</p>
      </div>
      <Button data-variant="icon" aria-label={i18n.close} onPress={() => go({ view: null })}>
        <span className="icon" data-icon="close" />
      </Button>
    </header>
    {images.length > 0 && (
      <ul className="pictures" aria-label={i18n.pictures.label} tabIndex={0}>
        {images.map((image) => (
          <li key={image.src}>
            <img src={image.src} alt={image.alt} loading="lazy" />
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
        <Button data-variant="primary" onPress={() => go({ view: null, edit: id })}>
          {i18n.actions.edit}
        </Button>
      )}
    </footer>
  </Dialog>
)
