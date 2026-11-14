// What the catalogue's render shows, worked out from what its read answered, in the page's words.

import { filtered, href, HOME } from '@/address'

export default ({ i18n, acl, async: { default: answer } }) => {
  const { filters, page, categories } = answer
  const category = categories.find(({ slug }) => slug === filters.category)?.name ?? ''
  const narrowed = Boolean(filters.q || filters.category)
  return {
    i18n,
    filters,
    categories,
    items: page.items,
    canChange: acl.allowed,
    summary: i18n.summary({ count: page.total, filter: filters.q && category ? 'both' : filters.q ? 'q' : category ? 'category' : 'none', q: filters.q, category }),
    empty: page.items.length === 0,
    emptyText: narrowed ? i18n.empty.narrowed : i18n.empty.none,
    clearHref: narrowed ? href(HOME) : null,
    createHref: href(filters, { create: true }),
    bulkHref: href(filters, { bulk: true }),
    paging: {
      shown: page.pages > 1,
      text: i18n.paging.page({ page: page.page, pages: page.pages }),
      previousHref: page.page > 1 ? filtered(filters, { page: page.page - 1 }) : null,
      nextHref: page.page < page.pages ? filtered(filters, { page: page.page + 1 }) : null,
    },
  }
}
