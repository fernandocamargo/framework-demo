import { Modal, ModalOverlay } from 'react-aria-components';

// Its width follows what it holds (base.css): a product is wide, a question or a failure small.
//
// Under another dialog it has not entered, as react-aria sees it: the dialog above takes the focus
// and makes the rest of the page inert, this one included. Without that, two dialogs that arrive
// together (an address that opens both) each make the other inert, and neither can be used.
export default ({ children, className, covered, handlers }) => (
  <ModalOverlay
    data-covered={covered || undefined}
    isDismissable
    isEntering={covered}
    isOpen
    onOpenChange={handlers.dismiss}
    UNSTABLE_deferUntilEntered={covered}
  >
    <Modal className={`react-aria-Modal ${className}`}>{children}</Modal>
  </ModalOverlay>
);
