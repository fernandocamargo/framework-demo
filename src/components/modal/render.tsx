import { Modal, ModalOverlay } from 'react-aria-components'

export default ({ className, size, onClose, children }) => (
  <ModalOverlay isOpen isDismissable onOpenChange={(open) => !open && onClose()}>
    <Modal className={`react-aria-Modal ${className}`} data-size={size}>
      {children}
    </Modal>
  </ModalOverlay>
)
