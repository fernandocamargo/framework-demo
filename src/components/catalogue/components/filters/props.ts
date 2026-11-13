// The filter bar's fields, from the filters in the address. Each change goes back to the
// address (render.tsx), and the catalogue reads again because its read used those fields.
import type { Filters } from '@/address'
import type { Category, SortKey } from '@/services/products/types'

export type Props = { filters: Filters; categories: Category[] }

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

export default ({ i18n, filters, categories }) => ({
  i18n,
  q: filters.q,
  category: filters.category || 'all',
  categories: [{ slug: 'all', name: i18n.category.all }, ...categories],
  sort: `${filters.sort}:${filters.order}`,
  sorts: SORTS.map(([field, order]) => ({ id: `${field}:${order}`, label: (i18n.sort[field] as Record<string, string>)[order] })),
})
