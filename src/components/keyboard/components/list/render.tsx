import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

// Each key is an action, as schema.org names one: potential while it does something now.
export default ({ className, groups, handlers, i18n }) => (
  <ModalOverlay isDismissable isOpen onOpenChange={handlers.dismiss}>
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog>
        <header>
          <Heading slot="title">{i18n.title}</Heading>
          <Button slot="close">{i18n.close}</Button>
        </header>
        <p>{i18n.intro}</p>
        {groups.length === 0 && <p>{i18n.none}</p>}
        {groups.map((group) => (
          <section aria-label={group.file} key={group.file}>
            <h3>
              <code>{group.file}</code>
            </h3>
            <dl>
              {group.shortcuts.map((shortcut) => (
                <div itemScope itemType="https://schema.org/Action" key={shortcut.keys.join('+')}>
                  <dt>
                    {shortcut.keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </dt>
                  <dd>
                    {shortcut.available && (
                      <link href="https://schema.org/PotentialActionStatus" itemProp="actionStatus" />
                    )}
                    <span itemProp="name">{shortcut.label}</span>
                    {!shortcut.available && <small>{i18n.unavailable}</small>}
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
