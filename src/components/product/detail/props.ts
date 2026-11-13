import { CURRENCY, STOCK_TONES, stockLevel } from '@/format'

export default ({ i18n, intl, async: { default: product } }) => {
  const level = stockLevel(product.stock)
  const images: string[] = product.images.length ? product.images : product.thumbnail ? [product.thumbnail] : []
  return {
    i18n,
    id: product.id,
    title: product.title,
    description: product.description,
    origin: [product.brand, product.category].filter(Boolean).join(' · '),
    price: intl.formatNumber(product.price, { style: 'currency', currency: CURRENCY }),
    stock: { tone: STOCK_TONES[level], label: i18n.stock({ level, count: product.stock }) },
    images: images.map((src, index) => ({ src, alt: i18n.pictures.picture({ title: product.title, index: index + 1 }) })),
    change: product.local === 'created' ? i18n.change.created : product.local === 'edited' ? i18n.change.edited : null,
  }
}
