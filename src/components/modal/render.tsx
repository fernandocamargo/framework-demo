import { Modal, ModalOverlay } from 'react-aria-components';

export default ({ children, className, onClose, size }) => (
  <ModalOverlay isDismissable isOpen onOpenChange={(open) => !open && onClose()}>
    <Modal className={`react-aria-Modal ${className}`} data-size={size}>
      {children}
    </Modal>
  </ModalOverlay>
);
