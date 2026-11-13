import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

export default ({ className, i18n, onClose, groups }) => (
  <ModalOverlay isOpen isDismissable onOpenChange={(open) => !open && onClose()}>
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog>
        <header>
          <Heading slot="title">{i18n.title}</Heading>
          <Button data-variant="icon" aria-label={i18n.close} onPress={onClose}>
            <span className="icon" data-icon="close" />
          </Button>
        </header>
        <p className="intro">{i18n.intro}</p>
        {groups.length === 0 && <p>{i18n.none}</p>}
        {groups.map((group) => (
          <section key={group.file} aria-label={group.file}>
            <h3>
              <code>{group.file}</code>
            </h3>
            <dl>
              {group.shortcuts.map((shortcut) => (
                <div key={shortcut.keys.join('+')} data-available={shortcut.available}>
                  <dt>
                    {shortcut.keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </dt>
                  <dd>
                    {shortcut.label}
                    {!shortcut.available && <span className="badge">{i18n.unavailable}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </Dialog>
    </Modal>
  </ModalOverlay>
)
