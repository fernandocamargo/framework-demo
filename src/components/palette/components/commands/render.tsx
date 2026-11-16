import { Dialog, Modal, ModalOverlay } from 'react-aria-components';

// The dialog owns the unchanged overlay, class and label. What it holds changes below its shell.
export default ({ children, className, handlers, title }) => (
  <ModalOverlay data-react-aria-top-layer="true" isDismissable isOpen onOpenChange={handlers.dismiss}>
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog aria-label={title}>{children}</Dialog>
    </Modal>
  </ModalOverlay>
);
