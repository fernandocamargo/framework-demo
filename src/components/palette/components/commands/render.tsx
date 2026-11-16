import { Dialog, Modal, ModalOverlay } from 'react-aria-components';

import Search from '../search';

// The dialog owns the unchanged overlay, class and label. Search changes below its shell.
export default ({ className, handlers, i18n, onClose }) => (
  <ModalOverlay data-react-aria-top-layer="true" isDismissable isOpen onOpenChange={handlers.dismiss}>
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog aria-label={i18n.title}>
        <Search onClose={onClose} title={i18n.title} />
      </Dialog>
    </Modal>
  </ModalOverlay>
);
