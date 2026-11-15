import {
  Autocomplete,
  Dialog,
  Header,
  Input,
  Menu,
  MenuItem,
  MenuSection,
  Modal,
  ModalOverlay,
  SearchField,
} from 'react-aria-components';

// The palette: what can be done now, and the products found, as a menu the person searches from
// the field. Each command is an action, as schema.org names one, potential while it can run; each
// product found is a product, by its name. While the products are searched, the search says it is
// busy: on the element itself, since react-aria's Menu passes no `aria-busy` on to the page.
export default ({ className, empty, handlers, i18n, onType, searching, sections, text }) => (
  <ModalOverlay data-react-aria-top-layer="true" isDismissable isOpen onOpenChange={handlers.dismiss}>
    <Modal className={`react-aria-Modal ${className}`}>
      <Dialog aria-label={i18n.title}>
        <search aria-busy={searching || undefined} itemScope itemType="https://schema.org/SearchAction">
          <meta content={text} itemProp="query" />
          <Autocomplete inputValue={text} onInputChange={onType}>
            <SearchField aria-label={i18n.field}>
              <Input placeholder={i18n.placeholder} />
            </SearchField>
            <Menu aria-label={i18n.title}>
              {sections.map((section) => (
                <MenuSection id={section.id} key={section.id}>
                  <Header>{section.heading}</Header>
                  {section.items.map((item) => (
                    <MenuItem
                      id={item.id}
                      isDisabled={!item.available}
                      key={item.id}
                      onAction={item.perform}
                      textValue={item.label}
                    >
                      {item.kind === 'product' ? (
                        <span itemScope itemType="https://schema.org/Product">
                          <span itemProp="name">{item.label}</span>
                        </span>
                      ) : (
                        <span itemScope itemType="https://schema.org/Action">
                          {item.available && (
                            <link href="https://schema.org/PotentialActionStatus" itemProp="actionStatus" />
                          )}
                          <span itemProp="name">{item.label}</span>
                          {item.keys.map((key) => (
                            <kbd key={key}>{key}</kbd>
                          ))}
                          {!item.available && <small>{i18n.unavailable}</small>}
                        </span>
                      )}
                    </MenuItem>
                  ))}
                </MenuSection>
              ))}
            </Menu>
          </Autocomplete>
        </search>
        {empty && <p>{i18n.none}</p>}
      </Dialog>
    </Modal>
  </ModalOverlay>
);
