import { Button, Input, ListBox, ListBoxItem, Popover, SearchField, Select, SelectValue } from 'react-aria-components';

// The catalogue's search, as the platform marks one and as schema.org names it: an action on the
// catalogue around it, with the words it searches for.
export default ({ categories, category, className, handlers, i18n, q, sort, sorts, text }) => (
  <search className={className} itemProp="potentialAction" itemScope itemType="https://schema.org/SearchAction">
    <meta content={q} itemProp="query" />
    {/* The form's text, which follows the address (form.ts): a search keeps the field and its focus. */}
    <SearchField
      aria-label={i18n.search.label}
      onChange={handlers.setSearch}
      onClear={handlers.clearSearch}
      onSubmit={handlers.search}
      value={text}
    >
      <Input placeholder={i18n.search.placeholder} />
      <Button aria-label={i18n.search.clear} />
    </SearchField>
    <Select aria-label={i18n.category.label} onSelectionChange={handlers.pickCategory} selectedKey={category}>
      <Button>
        <SelectValue />
      </Button>
      <Popover>
        <ListBox items={categories}>{(item) => <ListBoxItem id={item.slug}>{item.name}</ListBoxItem>}</ListBox>
      </Popover>
    </Select>
    <select aria-label={i18n.sort.label} onChange={handlers.pickSort} value={sort}>
      {sorts.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  </search>
);
