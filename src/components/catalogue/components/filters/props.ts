// The filter bar's fields, from the filters in the address. Each change goes back to the
// address (render.tsx), and the catalogue reads again because its read used those fields.
import type { Filters } from '@/address'
import type { Category, SortKey } from '@/services/products/types'

export type Props = { filters: Filters; categories: Category[] }

export const SORTS: { id: `${SortKey}:${'asc' | 'desc'}`; label: string }[] = [
  { id: 'title:asc', label: 'Title, A to Z' },
  { id: 'price:asc', label: 'Price, low to high' },
  { id: 'price:desc', label: 'Price, high to low' },
  { id: 'rating:desc', label: 'Rating, best first' },
  { id: 'stock:asc', label: 'Stock, lowest first' },
]

/** A sort option's id, as the address's two fields. */
export const sorting = (id: string) => {
  const [sort, order] = id.split(':') as [SortKey, 'asc' | 'desc']
  return { sort, order }
}

export default ({ filters, categories }) => ({
  q: filters.q,
  category: filters.category || 'all',
  categories: [{ slug: 'all', name: 'All categories' }, ...categories],
  sort: `${filters.sort}:${filters.order}`,
  sorts: SORTS,
})
