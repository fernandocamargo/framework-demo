// The editor's fields: how a product becomes their values, how the values become the changes
// to save, and what is wrong with them. Pure functions; the framework keeps the values.

import type { Changes, Detailed } from '@/services/products/types';

export const seed = (product: Detailed | undefined) => ({
  brand: product?.brand ?? '',
  category: product?.category ?? '',
  description: product?.description ?? '',
  price: product?.price ?? Number.NaN,
  stock: product?.stock ?? 0,
  title: product?.title ?? '',
});

export type Values = ReturnType<typeof seed>;

export const payload = (values: Values): Changes => ({
  brand: values.brand.trim(),
  category: values.category,
  description: values.description.trim(),
  price: Math.round(values.price * 100) / 100,
  stock: Math.trunc(values.stock),
  title: values.title.trim(),
});

/** The fields whose values stop a save. Empty when nothing does. Each is worded by i18n.ts's `problems`. */
export const problems = (values: Values) => {
  const found: ('category' | 'price' | 'stock' | 'title')[] = [];
  if (!values.title.trim()) found.push('title');
  if (!values.category) found.push('category');
  if (!(values.price > 0)) found.push('price');
  if (!(values.stock >= 0)) found.push('stock');
  return found;
};
