import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { go } from '@/address'

export default ({ className, error, resetErrorBoundary }) => (
  <ModalOverlay isOpen isDismissable onOpenChange={(open) => !open && go({ view: null })}>
    <Modal className={`react-aria-Modal ${className}`} data-size="small">
      <Dialog role="alertdialog">
        <Heading slot="title">The product could not be read</Heading>
        <p>{error.message}</p>
        <footer>
          <Button onPress={() => go({ view: null })}>Close</Button>
          <Button data-variant="primary" onPress={resetErrorBoundary}>
            Try again
          </Button>
        </footer>
      </Dialog>
    </Modal>
  </ModalOverlay>
)
