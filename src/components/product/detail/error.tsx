import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { go } from '@/address'

export default ({ className, i18n, error, resetErrorBoundary }) => (
  <ModalOverlay isOpen isDismissable onOpenChange={(open) => !open && go({ view: null })}>
    <Modal className={`react-aria-Modal ${className}`} data-size="small">
      <Dialog role="alertdialog">
        <Heading slot="title">{i18n.failed.title}</Heading>
        <p>{error.message}</p>
        <footer>
          <Button onPress={() => go({ view: null })}>{i18n.failed.close}</Button>
          <Button data-variant="primary" onPress={resetErrorBoundary}>
            {i18n.failed.retry}
          </Button>
        </footer>
      </Dialog>
    </Modal>
  </ModalOverlay>
)
