import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

export default ({ className, groups, i18n, onClose }) => (
  <ModalOverlay isDismissable isOpen onOpenChange={(open) => !open && onClose()}>
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog>
        <header>
          <Heading slot="title">{i18n.title}</Heading>
          <Button aria-label={i18n.close} data-variant="icon" onPress={onClose}>
            <span className="icon" data-icon="close" />
          </Button>
        </header>
        <p className="intro">{i18n.intro}</p>
        {groups.length === 0 && <p>{i18n.none}</p>}
        {groups.map((group) => (
          <section aria-label={group.file} key={group.file}>
            <h3>
              <code>{group.file}</code>
            </h3>
            <dl>
              {group.shortcuts.map((shortcut) => (
                <div data-available={shortcut.available} key={shortcut.keys.join('+')}>
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
);
