import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

export default ({ className, state, i18n }) => (
  <ModalOverlay isOpen onOpenChange={(open) => !open && state.send({ type: 'cancel' })}>
    <Modal className={`react-aria-Modal ${className}`} data-size="small">
      <Dialog role="alertdialog">
        <Heading slot="title">{state.context.title ? i18n.title.named({ title: state.context.title }) : i18n.title.unnamed}</Heading>
        <p>{i18n.text}</p>
        {state.failed && (
          <div className="notice" data-tone="danger" role="alert">
            <span className="icon" data-icon="alert" />
            <p>{i18n.failed({ message: state.context.error ?? '' })}</p>
          </div>
        )}
        <footer>
          <Button autoFocus onPress={() => state.send({ type: 'cancel' })} isDisabled={state.removing}>
            {i18n.cancel}
          </Button>
          <Button data-variant="danger" isDisabled={state.loading} isPending={state.removing} onPress={() => state.send({ type: 'confirm' })}>
            {state.removing && <span className="spinner" aria-hidden="true" />}
            {state.failed ? i18n.confirm.retry : i18n.confirm.remove}
          </Button>
        </footer>
      </Dialog>
    </Modal>
  </ModalOverlay>
)
