import {
  Button,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SearchField,
  Select,
  SelectValue,
} from 'react-aria-components';

import { go } from '@/address';

import { sorting } from './props';

export default ({ categories, category, className, i18n, q, sort, sorts }) => (
  <div className={className} role="search">
    {/* Keyed by the address's text, so the field follows the back button. */}
    <SearchField
      aria-label={i18n.search.label}
      defaultValue={q}
      key={q}
      onClear={() => go({ page: 1, q: '' })}
      onSubmit={(text) => go({ page: 1, q: text.trim() })}
    >
      <span className="icon" data-icon="search" />
      <Input placeholder={i18n.search.placeholder} />
      <Button aria-label={i18n.search.clear}>
        <span className="icon" data-icon="close" />
      </Button>
    </SearchField>
    <Select
      aria-label={i18n.category.label}
      onSelectionChange={(key) => go({ category: key === 'all' ? '' : String(key), page: 1 })}
      selectedKey={category}
    >
      <Label className="visually-hidden">{i18n.category.label}</Label>
      <Button>
        <SelectValue />
        <span className="icon" data-icon="chevron" />
      </Button>
      <Popover>
        <ListBox items={categories}>{(item) => <ListBoxItem id={item.slug}>{item.name}</ListBoxItem>}</ListBox>
      </Popover>
    </Select>
    <Select
      aria-label={i18n.sort.label}
      onSelectionChange={(key) => go({ ...sorting(String(key)), page: 1 })}
      selectedKey={sort}
    >
      <Label className="visually-hidden">{i18n.sort.label}</Label>
      <Button>
        <SelectValue />
        <span className="icon" data-icon="chevron" />
      </Button>
      <Popover>
        <ListBox items={sorts}>{(item) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>}</ListBox>
      </Popover>
    </Select>
  </div>
);
