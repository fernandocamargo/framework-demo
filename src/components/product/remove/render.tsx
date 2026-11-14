import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

export default ({ acl, className, flags, i18n, state }) => (
  <ModalOverlay isOpen onOpenChange={(open) => !open && state.send({ type: 'cancel' })}>
    <Modal className={`react-aria-Modal ${className}`} data-size="small">
      <Dialog role="alertdialog">
        <Heading slot="title">
          {state.context.title ? i18n.title.named({ title: state.context.title }) : i18n.title.unnamed}
        </Heading>
        <p>{i18n.text}</p>
        {!acl.allowed && (
          <p className="notice" data-tone="info" role="note">
            <span className="icon" data-icon="user" />
            {flags.deletions ? i18n.refused : i18n.paused}
          </p>
        )}
        {state.failed && (
          <div className="notice" data-tone="danger" role="alert">
            <span className="icon" data-icon="alert" />
            <p>{i18n.failed({ message: state.context.error ?? '' })}</p>
          </div>
        )}
        <footer>
          <Button autoFocus isDisabled={state.removing} onPress={() => state.send({ type: 'cancel' })}>
            {i18n.cancel}
          </Button>
          <Button
            data-variant="danger"
            isDisabled={state.loading || !acl.allowed}
            isPending={state.removing}
            onPress={() => state.send({ type: 'confirm' })}
          >
            {state.removing && <span aria-hidden="true" className="spinner" />}
            {state.failed ? i18n.confirm.retry : i18n.confirm.remove}
          </Button>
        </footer>
      </Dialog>
    </Modal>
  </ModalOverlay>
);
