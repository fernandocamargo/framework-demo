import { Dialog, Modal, ModalOverlay } from 'react-aria-components'
import { go } from '@/address'

export default ({ className, i18n }) => (
  <ModalOverlay isOpen isDismissable onOpenChange={(open) => !open && go({ view: null })}>
    <Modal className={`react-aria-Modal ${className}`} data-size="large">
      <Dialog aria-label={i18n.loading} aria-busy="true">
        <div className="skeleton" style={{ blockSize: '1.6rem', inlineSize: '60%' }} />
        <div className="skeleton" style={{ blockSize: '9rem' }} />
        <div className="skeleton" style={{ blockSize: '3rem' }} />
      </Dialog>
    </Modal>
  </ModalOverlay>
)
