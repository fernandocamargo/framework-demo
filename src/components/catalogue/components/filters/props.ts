// The filter bar's fields, from the filters in the address. Each change goes back to the
// address (render.tsx), and the catalogue reads again because its read used those fields.
// It is given the fields it shows, not the filters whole: another page of the same list is not
// another filter bar.

import type { Filters } from '@/address';
import type { Category, SortKey } from '@/services/products/types';

export type Props = Pick<Filters, 'category' | 'order' | 'q' | 'sort'> & { categories: Category[] };

/** The sorts offered, as the address's two fields. */
export const SORTS = [
  ['title', 'asc'],
  ['price', 'asc'],
  ['price', 'desc'],
  ['rating', 'desc'],
  ['stock', 'asc'],
] as const satisfies readonly (readonly [SortKey, 'asc' | 'desc'])[];

/** A sort option's id, as the address's two fields. */
export const sorting = (id: string) => {
  const [sort, order] = id.split(':') as [SortKey, 'asc' | 'desc'];
  return { order, sort };
};

export default ({ categories, category, i18n, order, q, sort }) => ({
  categories: [{ name: i18n.category.all, slug: 'all' }, ...categories],
  category: category || 'all',
  i18n,
  q,
  sort: `${sort}:${order}`,
  sorts: SORTS.map(([field, order]) => ({
    id: `${field}:${order}`,
    label: (i18n.sort[field] as Record<string, string>)[order],
  })),
});

const CATEGORIES = [
  { name: 'Audio', slug: 'audio' },
  { name: 'Lighting', slug: 'lighting' },
];

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'Every product': { props: { categories: CATEGORIES, category: '', order: 'asc', q: '', sort: 'title' } },
  'Searched and sorted': {
    props: { categories: CATEGORIES, category: 'lighting', order: 'desc', q: 'lamp', sort: 'price' },
  },
};
