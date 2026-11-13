// What the catalogue's render shows, worked out from what its read answered.
import { filtered, href, HOME } from '@/address'
import { plural } from '@/format'

export default ({ async: { default: answer } }) => {
  const { filters, page, categories } = answer
  const category = categories.find(({ slug }) => slug === filters.category)?.name
  const narrowed = Boolean(filters.q || filters.category)
  return {
    filters,
    categories,
    items: page.items,
    summary: [plural(page.total, 'product'), filters.q && `matching “${filters.q}”`, category && `in ${category}`].filter(Boolean).join(' '),
    empty: page.items.length === 0,
    emptyText: narrowed ? 'No product matches these filters.' : 'The catalogue is empty.',
    clearHref: narrowed ? href(HOME) : null,
    createHref: href(filters, { create: true }),
    bulkHref: href(filters, { bulk: true }),
    paging: {
      shown: page.pages > 1,
      text: `Page ${page.page} of ${page.pages}`,
      previousHref: page.page > 1 ? filtered(filters, { page: page.page - 1 }) : null,
      nextHref: page.page < page.pages ? filtered(filters, { page: page.page + 1 }) : null,
    },
  }
}
