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

/** What stops these values from being saved, by field. Empty when nothing does. */
export const problems = (values: Values) => {
  const found: Partial<Record<keyof Values, string>> = {}
  if (!values.title.trim()) found.title = 'A product needs a title.'
  if (!values.category) found.category = 'Choose a category.'
  if (!(values.price > 0)) found.price = 'The price must be more than zero.'
  if (!(values.stock >= 0)) found.stock = 'The stock cannot be negative.'
  return found
}
