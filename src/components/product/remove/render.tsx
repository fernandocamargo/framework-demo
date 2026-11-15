import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

export default ({ acl, className, flags, handlers, i18n, state }) => (
  <ModalOverlay isOpen onOpenChange={handlers.dismiss}>
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog role="alertdialog">
        <Heading slot="title">
          {state.context.title ? i18n.title.named({ title: state.context.title }) : i18n.title.unnamed}
        </Heading>
        <p>{i18n.text}</p>
        {!acl.allowed && <p role="note">{flags.deletions ? i18n.refused : i18n.paused}</p>}
        {state.failed && (
          <div itemScope itemType="https://schema.org/DeleteAction" role="alert">
            <link href="https://schema.org/FailedActionStatus" itemProp="actionStatus" />
            <p itemProp="error">{i18n.failed({ message: state.context.error ?? '' })}</p>
          </div>
        )}
        <footer>
          <Button autoFocus isDisabled={state.removing} onPress={handlers.cancel}>
            {i18n.cancel}
          </Button>
          <Button isDisabled={state.loading || !acl.allowed} isPending={state.removing} onPress={handlers.confirm}>
            <span itemScope itemType="https://schema.org/DeleteAction">
              <span itemProp="name">{state.failed ? i18n.confirm.retry : i18n.confirm.remove}</span>
            </span>
          </Button>
        </footer>
      </Dialog>
    </Modal>
  </ModalOverlay>
);
