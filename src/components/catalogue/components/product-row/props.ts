// One row of the catalogue. It is given its product as the catalogue's read answered it, and
// the filters, so its links keep them. Prices and ratings are formatted for the locale on screen.

import { href, type Filters } from '@/address'
import { CURRENCY, STOCK_TONES, stockLevel } from '@/format'
import type { Listed } from '@/services/products/types'

export type Props = { product: Listed; filters: Filters }

export default ({ product, filters, i18n, intl, acl, flags, async: { setStock } }) => {
  const level = stockLevel(product.stock)
  // Counting stock is being rolled out (the `stockCount` flag), and needs the grant to update
  // products and someone signed in to send it.
  const counts = flags.stockCount && acl.allowed && acl.role !== 'guest'
  return {
    title: product.title,
    thumbnail: product.thumbnail,
    origin: [product.brand, product.category].filter(Boolean).join(' · '),
    price: intl.formatNumber(product.price, { style: 'currency', currency: CURRENCY }),
    rated: i18n.rated,
    rating: product.rating ? intl.formatNumber(product.rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null,
    stock: { tone: STOCK_TONES[level], label: i18n.stock({ level, count: product.stock }) },
    change: product.local === 'created' ? i18n.change.created : product.local === 'edited' ? i18n.change.edited : null,
    viewHref: href(filters, { view: product.id }),
    canEdit: acl.allowed,
    editHref: href(filters, { edit: product.id }),
    editLabel: i18n.actions.edit({ title: product.title }),
    removeHref: href(filters, { remove: product.id }),
    stepper: counts
      ? {
          label: i18n.count.label({ title: product.title }),
          less: { label: i18n.count.less, disabled: product.stock === 0, press: () => setStock(product.id, product.stock - 1) },
          more: { label: i18n.count.more, press: () => setStock(product.id, product.stock + 1) },
          sending: setStock.pending,
        }
      : null,
  }
}

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'In stock': {
    props: {
      product: { id: 22, title: 'Arc Floor Lamp', description: 'Arc Floor Lamp for a home office.', category: 'lighting', brand: 'Fieldwork', price: 273.99, stock: 58, rating: 4.2, thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' fill='%23a07040'/%3E%3C/svg%3E", version: 1 },
      filters: { q: '', category: '', sort: 'title', order: 'asc', page: 1 },
    },
  },
  'Low, edited here': {
    props: {
      product: { id: 22, title: 'Arc Floor Lamp', description: 'Arc Floor Lamp for a home office.', category: 'lighting', brand: 'Fieldwork', price: 249.99, stock: 3, rating: 4.2, thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' fill='%23a07040'/%3E%3C/svg%3E", version: 2, local: 'edited' },
      filters: { q: 'lamp', category: '', sort: 'price', order: 'desc', page: 1 },
    },
  },
}
