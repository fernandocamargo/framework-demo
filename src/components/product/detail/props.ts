import { money, stockLevel } from '@/format'

export default ({ async: { default: product } }) => ({
  id: product.id,
  title: product.title,
  description: product.description,
  origin: [product.brand, product.category].filter(Boolean).join(' · '),
  price: money(product.price),
  stock: stockLevel(product.stock),
  images: product.images.length ? product.images : product.thumbnail ? [product.thumbnail] : [],
  change: product.local === 'created' ? 'Created in this browser' : product.local === 'edited' ? 'Edited in this browser' : null,
})
