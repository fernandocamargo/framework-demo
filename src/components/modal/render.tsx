import { Modal, ModalOverlay } from 'react-aria-components';

// Its width follows what it holds (base.css): a product is wide, a question or a failure small.
export default ({ children, className, handlers }) => (
  <ModalOverlay isDismissable isOpen onOpenChange={handlers.dismiss}>
    <Modal className={`react-aria-Modal ${className}`}>{children}</Modal>
  </ModalOverlay>
);
