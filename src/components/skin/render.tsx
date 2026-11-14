import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';

import { type Skin, wear } from '@/skins';

// The select keeps its own choice: the page's skin changes around it, and nothing here follows it.
export default ({ className, label, options, skin }) => (
  <div className={className}>
    <Select aria-label={label} defaultSelectedKey={skin} onSelectionChange={(key) => wear(key as Skin)}>
      <Button>
        <SelectValue />
      </Button>
      <Popover>
        <ListBox items={options}>{(option) => <ListBoxItem id={option.id}>{option.name}</ListBoxItem>}</ListBox>
      </Popover>
    </Select>
  </div>
);
