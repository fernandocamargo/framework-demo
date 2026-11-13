import { Button, Input, Label, ListBox, ListBoxItem, Popover, SearchField, Select, SelectValue } from 'react-aria-components'
import { go } from '@/address'
import { sorting } from './props'

export default ({ className, i18n, q, category, categories, sort, sorts }) => (
  <div className={className} role="search">
    {/* Keyed by the address's text, so the field follows the back button. */}
    <SearchField key={q} defaultValue={q} aria-label={i18n.search.label} onSubmit={(text) => go({ q: text.trim(), page: 1 })} onClear={() => go({ q: '', page: 1 })}>
      <span className="icon" data-icon="search" />
      <Input placeholder={i18n.search.placeholder} />
      <Button aria-label={i18n.search.clear}>
        <span className="icon" data-icon="close" />
      </Button>
    </SearchField>
    <Select aria-label={i18n.category.label} selectedKey={category} onSelectionChange={(key) => go({ category: key === 'all' ? '' : String(key), page: 1 })}>
      <Label className="visually-hidden">{i18n.category.label}</Label>
      <Button>
        <SelectValue />
        <span className="icon" data-icon="chevron" />
      </Button>
      <Popover>
        <ListBox items={categories}>{(item) => <ListBoxItem id={item.slug}>{item.name}</ListBoxItem>}</ListBox>
      </Popover>
    </Select>
    <Select aria-label={i18n.sort.label} selectedKey={sort} onSelectionChange={(key) => go({ ...sorting(String(key)), page: 1 })}>
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
)
