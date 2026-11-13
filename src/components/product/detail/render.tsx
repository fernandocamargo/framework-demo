import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { go } from '@/address'
import Reviews from './components/reviews'

export default ({ className, id, title, description, origin, price, stock, images, change }) => (
  <ModalOverlay isOpen isDismissable onOpenChange={(open) => !open && go({ view: null })}>
    <Modal className={`react-aria-Modal ${className}`} data-size="large">
      <Dialog>
        <header>
          <div>
            <Heading slot="title">{title}</Heading>
            <p className="origin">{origin}</p>
          </div>
          <Button data-variant="icon" aria-label="Close" onPress={() => go({ view: null })}>
            <span className="icon" data-icon="close" />
          </Button>
        </header>
        {images.length > 0 && (
          <ul className="pictures" aria-label="Pictures" tabIndex={0}>
            {images.map((image, index) => (
              <li key={image}>
                <img src={image} alt={`${title}, picture ${index + 1}`} loading="lazy" />
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
          <Button onPress={() => go({ view: null, remove: id })}>Delete</Button>
          <Button data-variant="primary" onPress={() => go({ view: null, edit: id })}>
            Edit
          </Button>
        </footer>
      </Dialog>
    </Modal>
  </ModalOverlay>
)
