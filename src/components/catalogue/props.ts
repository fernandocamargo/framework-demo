// What the catalogue's render shows, worked out from what its read answered, in the page's words.

import type { ReactNode } from 'react';

import { filtered, HOME, href } from '@/address';

export default ({ acl, async: { default: answer }, i18n }) => {
  const { categories, filters, page } = answer;
  const category = categories.find(({ slug }) => slug === filters.category)?.name ?? '';
  const narrowed = Boolean(filters.q || filters.category);
  return {
    bulkHref: href(filters, { bulk: true }),
    canChange: acl.allowed,
    categories,
    clearHref: narrowed ? href(HOME) : null,
    createHref: href(filters, { create: true }),
    empty: page.items.length === 0,
    emptyText: narrowed ? i18n.empty.narrowed : i18n.empty.none,
    filters,
    i18n,
    items: page.items,
    paging: {
      nextHref: page.page < page.pages ? filtered(filters, { page: page.page + 1 }) : null,
      previousHref: page.page > 1 ? filtered(filters, { page: page.page - 1 }) : null,
      shown: page.pages > 1,
      text: i18n.paging.page({ page: page.page, pages: page.pages }),
    },
    /** How many products, with what marks the count: `summary(count)`. */
    summary: (count: (chunks: ReactNode[]) => ReactNode) =>
      i18n.summary({
        category,
        count: page.total,
        filter: filters.q && category ? 'both' : filters.q ? 'q' : category ? 'category' : 'none',
        q: filters.q,
        total: count,
      }),
    total: page.total,
  };
};
