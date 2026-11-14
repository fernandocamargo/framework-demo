// The filter bar's fields, from the filters in the address. Each change goes back to the
// address (render.tsx), and the catalogue reads again because its read used those fields.
// It is given the fields it shows, not the filters whole: another page of the same list is not
// another filter bar.
import type { Filters } from '@/address'
import type { Category, SortKey } from '@/services/products/types'

export type Props = Pick<Filters, 'q' | 'category' | 'sort' | 'order'> & { categories: Category[] }

/** The sorts offered, as the address's two fields. */
export const SORTS = [
  ['title', 'asc'],
  ['price', 'asc'],
  ['price', 'desc'],
  ['rating', 'desc'],
  ['stock', 'asc'],
] as const satisfies readonly (readonly [SortKey, 'asc' | 'desc'])[]

/** A sort option's id, as the address's two fields. */
export const sorting = (id: string) => {
  const [sort, order] = id.split(':') as [SortKey, 'asc' | 'desc']
  return { sort, order }
}

export default ({ i18n, q, category, sort, order, categories }) => ({
  i18n,
  q,
  category: category || 'all',
  categories: [{ slug: 'all', name: i18n.category.all }, ...categories],
  sort: `${sort}:${order}`,
  sorts: SORTS.map(([field, order]) => ({ id: `${field}:${order}`, label: (i18n.sort[field] as Record<string, string>)[order] })),
})
