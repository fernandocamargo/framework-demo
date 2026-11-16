import { Autocomplete, Header, Input, Menu, MenuItem, MenuSection, SearchField } from 'react-aria-components';

// The field and its results change below the dialog. The gallery gives the standalone field its
// folder class; the live dialog keeps its exact markup and the shell's descendant selectors.
export default ({ className, empty, handlers, i18n, searching, sections, standalone, text, title }) => (
  <>
    <search
      aria-busy={searching || undefined}
      className={standalone ? className : undefined}
      itemScope
      itemType="https://schema.org/SearchAction"
    >
      <meta content={text} itemProp="query" />
      <Autocomplete inputValue={text} onInputChange={handlers.type}>
        <SearchField aria-label={i18n.field}>
          <Input placeholder={i18n.placeholder} />
        </SearchField>
        <Menu aria-label={title}>
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
  </>
);
