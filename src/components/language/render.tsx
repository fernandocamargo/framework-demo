import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';

import { type Locale, speak } from '@/locales';

export default ({ className, label, locale, options }) => (
  <div className={className}>
    <Select aria-label={label} onSelectionChange={(key) => speak(key as Locale)} selectedKey={locale}>
      <Label className="visually-hidden">{label}</Label>
      <Button>
        <span className="icon" data-icon="globe" />
        <SelectValue />
        <span className="icon" data-icon="chevron" />
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
