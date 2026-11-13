// The editor's fields: how a product becomes their values, how the values become the changes
// to save, and what is wrong with them. Pure functions; the framework keeps the values.
import type { Changes, Detailed } from '@/services/products/types'

export const seed = (product: Detailed | undefined) => ({
  title: product?.title ?? '',
  description: product?.description ?? '',
  category: product?.category ?? '',
  brand: product?.brand ?? '',
  price: product?.price ?? Number.NaN,
  stock: product?.stock ?? 0,
})

export type Values = ReturnType<typeof seed>

export const payload = (values: Values): Changes => ({
  title: values.title.trim(),
  description: values.description.trim(),
  category: values.category,
  brand: values.brand.trim(),
  price: Math.round(values.price * 100) / 100,
  stock: Math.trunc(values.stock),
})

/** The fields whose values stop a save. Empty when nothing does. Each is worded by i18n.ts's `problems`. */
export const problems = (values: Values) => {
  const found: ('title' | 'category' | 'price' | 'stock')[] = []
  if (!values.title.trim()) found.push('title')
  if (!values.category) found.push('category')
  if (!(values.price > 0)) found.push('price')
  if (!(values.stock >= 0)) found.push('stock')
  return found
}
