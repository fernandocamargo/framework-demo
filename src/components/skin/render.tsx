import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';

// The select keeps its own choice: the page's skin changes around it, and nothing here follows it.
export default ({ className, handlers, label, options, skin }) => (
  <div className={className}>
    <Select aria-label={label} defaultSelectedKey={skin} onSelectionChange={handlers.wearSkin}>
      <Button>
        <SelectValue />
      </Button>
      <Popover>
        <ListBox items={options}>{(option) => <ListBoxItem id={option.id}>{option.name}</ListBoxItem>}</ListBox>
      </Popover>
    </Select>
  </div>
);
