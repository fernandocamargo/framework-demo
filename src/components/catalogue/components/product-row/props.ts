// One row of the catalogue. It is given its product as the catalogue's read answered it, and
// the filters, so its links keep them. Prices and ratings are formatted for the locale on screen.
import { href, type Filters } from '@/address'
import { CURRENCY, STOCK_TONES, stockLevel } from '@/format'
import type { Listed } from '@/services/products/types'

export type Props = { product: Listed; filters: Filters }

export default ({ product, filters, i18n, intl, acl, async: { setStock } }) => {
  const level = stockLevel(product.stock)
  // Counting stock needs the grant to update products, and someone signed in to send it.
  const counts = acl.allowed && acl.role !== 'guest'
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
