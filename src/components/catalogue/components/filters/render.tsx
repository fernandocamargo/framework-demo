import { Button, Input, ListBox, ListBoxItem, Popover, SearchField, Select, SelectValue } from 'react-aria-components';

import { go } from '@/address';

import { sorting } from './props';

// The catalogue's search, as the platform marks one and as schema.org names it: an action on the
// catalogue around it, with the words it searches for.
export default ({ categories, category, className, i18n, q, sort, sorts }) => (
  <search className={className} itemProp="potentialAction" itemScope itemType="https://schema.org/SearchAction">
    <meta content={q} itemProp="query" />
    {/* Keyed by the address's text, so the field follows the back button. */}
    <SearchField
      aria-label={i18n.search.label}
      defaultValue={q}
      key={q}
      onClear={() => go({ page: 1, q: '' })}
      onSubmit={(text) => go({ page: 1, q: text.trim() })}
    >
      <Input placeholder={i18n.search.placeholder} />
      <Button aria-label={i18n.search.clear} />
    </SearchField>
    <Select
      aria-label={i18n.category.label}
      onSelectionChange={(key) => go({ category: key === 'all' ? '' : String(key), page: 1 })}
      selectedKey={category}
    >
      <Button>
        <SelectValue />
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
      <Button>
        <SelectValue />
      </Button>
      <Popover>
        <ListBox items={sorts}>{(item) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>}</ListBox>
      </Popover>
    </Select>
  </search>
);
