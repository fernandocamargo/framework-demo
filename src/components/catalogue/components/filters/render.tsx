import { Button, Input, ListBox, ListBoxItem, Popover, SearchField, Select, SelectValue } from 'react-aria-components';

import { go } from '@/address';

import { sorting } from './props';

// The catalogue's search, as the platform marks one and as schema.org names it: an action on the
// catalogue around it, with the words it searches for.
export default ({ categories, category, className, i18n, q, set, sort, sorts, text }) => (
  <search className={className} itemProp="potentialAction" itemScope itemType="https://schema.org/SearchAction">
    <meta content={q} itemProp="query" />
    {/* The form's text, which follows the address (form.ts): a search keeps the field and its focus. */}
    <SearchField
      aria-label={i18n.search.label}
      onChange={(typed) => set('q', typed)}
      onClear={() => go({ page: 1, q: '' })}
      onSubmit={(typed) => go({ page: 1, q: typed.trim() })}
      value={text}
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
