import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

export default ({ className, state }) => (
  <ModalOverlay isOpen onOpenChange={(open) => !open && state.send({ type: 'cancel' })}>
    <Modal className={`react-aria-Modal ${className}`} data-size="small">
      <Dialog role="alertdialog">
        <Heading slot="title">{state.context.title ? `Delete ${state.context.title}?` : 'Delete this product?'}</Heading>
        <p>It leaves the catalogue. The deletion is kept in this browser only, since DummyJSON keeps no writes.</p>
        {state.failed && (
          <div className="notice" data-tone="danger" role="alert">
            <span className="icon" data-icon="alert" />
            <p>It was not deleted: {state.context.error}</p>
          </div>
        )}
        <footer>
          <Button autoFocus onPress={() => state.send({ type: 'cancel' })} isDisabled={state.removing}>
            Cancel
          </Button>
          <Button data-variant="danger" isDisabled={state.loading} isPending={state.removing} onPress={() => state.send({ type: 'confirm' })}>
            {state.removing && <span className="spinner" aria-hidden="true" />}
            {state.failed ? 'Try again' : 'Delete'}
          </Button>
        </footer>
      </Dialog>
    </Modal>
  </ModalOverlay>
)
