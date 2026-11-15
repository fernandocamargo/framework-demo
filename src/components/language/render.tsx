import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';

// The language on screen, as schema.org names one, by its code.
export default ({ className, handlers, label, locale, options }) => (
  <div className={className} itemScope itemType="https://schema.org/Language">
    <meta content={locale} itemProp="alternateName" />
    <Select aria-label={label} onSelectionChange={handlers.speakLanguage} selectedKey={locale}>
      <Button>
        <SelectValue />
      </Button>
      <Popover>
        <ListBox items={options}>
          {(option) => (
            <ListBoxItem id={option.id} lang={option.id}>
              {option.name}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  </div>
);
