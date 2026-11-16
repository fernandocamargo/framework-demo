import {
  type ChangeEvent,
  type Key,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { Button, Input, ListBox, ListBoxItem, Popover, SearchField, Select, SelectValue } from 'react-aria-components';
import { createRoot } from 'react-dom/client';

type Variant = 'aria-docs' | 'aria-framework' | 'native';
type Category = { name: string; slug: string };
type Sort = { id: string; label: string };
type Chosen = { category: string; page: number; q: string; sort: string };

// The locale does not change during this visit, so its messages keep their identity.
const i18n = {
  category: { all: 'All categories', label: 'Category' },
  search: { clear: 'Clear the search', label: 'Search products', placeholder: 'Search products, then press Enter' },
  sort: {
    label: 'Sort',
    price: { asc: 'Price, low to high', desc: 'Price, high to low' },
    rating: { desc: 'Rating, best first' },
    stock: { asc: 'Stock, lowest first' },
    title: { asc: 'Title, A to Z' },
  },
};
const CATEGORIES: Category[] = [
  'Audio',
  'Bedding',
  'Cameras',
  'Chairs',
  'Clocks',
  'Desks',
  'Displays',
  'Fans',
  'Garden',
  'Keyboards',
  'Kitchen',
  'Lighting',
  'Mirrors',
  'Monitors',
  'Rugs',
  'Shelves',
  'Storage',
  'Tables',
  'Tools',
  'Vases',
].map((name) => ({ name, slug: name.toLowerCase() }));
const SORTS = [
  ['title', 'asc'],
  ['price', 'asc'],
  ['price', 'desc'],
  ['rating', 'desc'],
  ['stock', 'asc'],
] as const;
const categories = [{ name: i18n.category.all, slug: 'all' }, ...CATEGORIES];
const sorts: Sort[] = SORTS.map(([field, order]) => ({
  id: `${field}:${order}`,
  label: (i18n.sort[field] as Record<string, string>)[order]!,
}));
const categoryItem = (item: Category) => <ListBoxItem id={item.slug}>{item.name}</ListBoxItem>;
const sortItem = (item: Sort) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>;

type Handlers = {
  clearSearch: () => void;
  pickCategory: (key: Key | null) => void;
  pickSort: (key: Key | null) => void;
  search: (typed: string) => void;
  setSearch: (typed: string) => void;
};
type Feed = {
  categories: Category[];
  category: string;
  className: string;
  handlers: Handlers;
  i18n: typeof i18n;
  q: string;
  sort: string;
  sorts: Sort[];
  text: string;
};

const searchChildren = () => (
  <>
    <Input placeholder={i18n.search.placeholder} />
    <Button aria-label={i18n.search.clear} />
  </>
);
const categoryChildren = (items: Category[]) => (
  <>
    <Button>
      <SelectValue />
    </Button>
    <Popover>
      <ListBox items={items}>{categoryItem}</ListBox>
    </Popover>
  </>
);
const sortChildren = (items: Sort[]) => (
  <>
    <Button>
      <SelectValue />
    </Button>
    <Popover>
      <ListBox items={items}>{sortItem}</ListBox>
    </Popover>
  </>
);
const searchControl = (text: string, handlers: Handlers, children: ReactNode) => (
  <SearchField
    aria-label={i18n.search.label}
    onChange={handlers.setSearch}
    onClear={handlers.clearSearch}
    onSubmit={handlers.search}
    value={text}
  >
    {children}
  </SearchField>
);
const categoryControl = (category: string, pick: Handlers['pickCategory'], children: ReactNode) => (
  <Select aria-label={i18n.category.label} onSelectionChange={pick} selectedKey={category}>
    {children}
  </Select>
);
const sortControl = (sort: string, pick: Handlers['pickSort'], children: ReactNode) => (
  <Select aria-label={i18n.sort.label} onSelectionChange={pick} selectedKey={sort}>
    {children}
  </Select>
);

// These are the unchanged descendants shareElements returns, without importing that machinery.
const sharedSearchChildren = searchChildren();

function NativeBar({ feed }: { feed: Feed }) {
  const changeText = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => feed.handlers.setSearch(event.target.value),
    [feed.handlers],
  );
  const submit = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') feed.handlers.search(event.currentTarget.value);
    },
    [feed.handlers],
  );
  const category = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => feed.handlers.pickCategory(event.target.value),
    [feed.handlers],
  );
  const sort = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => feed.handlers.pickSort(event.target.value),
    [feed.handlers],
  );
  return (
    <search className={feed.className} itemProp="potentialAction" itemScope itemType="https://schema.org/SearchAction">
      <meta content={feed.q} itemProp="query" />
      <input
        aria-label={feed.i18n.search.label}
        onChange={changeText}
        onKeyDown={submit}
        placeholder={feed.i18n.search.placeholder}
        type="search"
        value={feed.text}
      />
      <select aria-label={feed.i18n.category.label} onChange={category} value={feed.category}>
        {feed.categories.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>
      <select aria-label={feed.i18n.sort.label} onChange={sort} value={feed.sort}>
        {feed.sorts.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </search>
  );
}

function FilterBar({
  category,
  onChoose,
  q,
  sort,
  variant,
}: {
  category: string;
  onChoose: (patch: Partial<Chosen>) => void;
  q: string;
  sort: string;
  variant: Variant;
}) {
  const [text, setText] = useState(q);
  const setSearch = useCallback((typed: string) => setText(typed), []);
  const clearSearch = useCallback(() => {
    setText('');
    onChoose({ page: 1, q: '' });
  }, [onChoose]);
  const search = useCallback(
    (typed: string) => {
      setText(typed.trim());
      onChoose({ page: 1, q: typed.trim() });
    },
    [onChoose],
  );
  const pickCategory = useCallback(
    (key: Key | null) => onChoose({ category: key === 'all' ? '' : String(key), page: 1 }),
    [onChoose],
  );
  const pickSort = useCallback((key: Key | null) => onChoose({ page: 1, sort: String(key) }), [onChoose]);
  const handlers = useMemo(
    () => ({ clearSearch, pickCategory, pickSort, search, setSearch }),
    [clearSearch, pickCategory, pickSort, search, setSearch],
  );

  // props.ts allocates these arrays, but useShow shares equal parts before calling the render.
  const shapedCategories = useMemo(() => [{ name: i18n.category.all, slug: 'all' }, ...CATEGORIES], []);
  const shapedSorts = useMemo(
    () =>
      SORTS.map(([field, order]) => ({
        id: `${field}:${order}`,
        label: (i18n.sort[field] as Record<string, string>)[order]!,
      })),
    [],
  );
  const sharedCategoryChildren = useMemo(() => categoryChildren(shapedCategories), [shapedCategories]);
  const sharedSortChildren = useMemo(() => sortChildren(shapedSorts), [shapedSorts]);
  const feed: Feed = {
    categories: variant === 'aria-framework' ? shapedCategories : categories,
    category: category || 'all',
    className: 'components/catalogue/components/filters',
    handlers,
    i18n,
    q,
    sort,
    sorts: variant === 'aria-framework' ? shapedSorts : sorts,
    text,
  };
  // Each memo has the values its corresponding subtree reads, as element sharing does today.
  const sharedSearch = useMemo(() => searchControl(text, handlers, sharedSearchChildren), [text, handlers]);
  const sharedCategory = useMemo(
    () => categoryControl(category || 'all', pickCategory, sharedCategoryChildren),
    [category, pickCategory, sharedCategoryChildren],
  );
  const sharedSort = useMemo(
    () => sortControl(sort, pickSort, sharedSortChildren),
    [sort, pickSort, sharedSortChildren],
  );
  if (variant === 'native') return <NativeBar feed={feed} />;
  return (
    <search className={feed.className} itemProp="potentialAction" itemScope itemType="https://schema.org/SearchAction">
      <meta content={q} itemProp="query" />
      {variant === 'aria-framework' ? sharedSearch : searchControl(text, handlers, searchChildren())}
      {variant === 'aria-framework'
        ? sharedCategory
        : categoryControl(feed.category, pickCategory, categoryChildren(feed.categories))}
      {variant === 'aria-framework' ? sharedSort : sortControl(sort, pickSort, sortChildren(feed.sorts))}
    </search>
  );
}

const ROWS = Array.from({ length: 12 }, (_, index) => index + 1);
function Row({ chosen, index }: { chosen: Chosen; index: number }) {
  return (
    <li data-category={chosen.category} data-page={chosen.page} data-query={chosen.q} data-sort={chosen.sort}>
      {index + (chosen.page - 1) * 12}. {chosen.q || 'All products'} · {chosen.category || 'all'} · {chosen.sort}
    </li>
  );
}

const requested = new URLSearchParams(location.search).get('variant') ?? 'aria-docs';
if (!['aria-docs', 'aria-framework', 'native'].includes(requested)) throw new Error(`Unknown variant: ${requested}`);
const variant = requested as Variant;

function App() {
  const [chosen, setChosen] = useState<Chosen>({ category: '', page: 1, q: '', sort: 'title:asc' });
  const choose = useCallback((patch: Partial<Chosen>) => setChosen((previous) => ({ ...previous, ...patch })), []);
  const navigate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      choose({ page: Number(new URL(event.currentTarget.href).searchParams.get('page')) });
    },
    [choose],
  );
  const href = (page: number) => `?${new URLSearchParams({ ...chosen, page: String(page), variant })}`;
  const { category, q, sort } = chosen;
  // The catalogue passes no page to Filters; equal props return the same element on paging.
  const sharedFilters = useMemo(
    () => <FilterBar category={category} onChoose={choose} q={q} sort={sort} variant={variant} />,
    [category, choose, q, sort],
  );
  return (
    <main>
      <h1>Isolated catalogue filters</h1>
      <p>{variant}</p>
      {variant === 'aria-framework' ? (
        sharedFilters
      ) : (
        <FilterBar category={category} onChoose={choose} q={q} sort={sort} variant={variant} />
      )}
      <nav aria-label="Pagination">
        <a href={href(Math.max(1, chosen.page - 1))} onClick={navigate}>
          Previous
        </a>
        <span>Page {chosen.page}</span>
        <a href={href(chosen.page + 1)} onClick={navigate}>
          Next
        </a>
      </nav>
      <ul aria-label="Products">
        {ROWS.map((index) => (
          <Row chosen={chosen} index={index} key={index} />
        ))}
      </ul>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
