// One row of the catalogue. It is given its product as the catalogue's read answered it, and
// the filters, so its links keep them.
import { href, type Filters } from '@/address'
import { money, stockLevel } from '@/format'
import type { Listed } from '@/services/products/types'

export type Props = { product: Listed; filters: Filters }

export default ({ product, filters }) => ({
  title: product.title,
  thumbnail: product.thumbnail,
  origin: [product.brand, product.category].filter(Boolean).join(' · '),
  price: money(product.price),
  rating: product.rating ? product.rating.toFixed(1) : null,
  stock: stockLevel(product.stock),
  change: product.local === 'created' ? 'New' : product.local === 'edited' ? 'Edited' : null,
  viewHref: href(filters, { view: product.id }),
  editHref: href(filters, { edit: product.id }),
  removeHref: href(filters, { remove: product.id }),
})
