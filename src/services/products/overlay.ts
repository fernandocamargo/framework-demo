// How the local overlay is laid over what the API answers. Pure functions: the services call
// them with what the two clients returned, and the tests call them with literals.

import type { Overlay } from '@/clients/local'
import type { Listed, Local, Page, Product, Query } from './types'

/** How many products a page of the catalogue holds. */
export const PAGE_SIZE = 12

export const versionOf = (overlay: Overlay, id: number) => overlay.edits[id]?.version ?? 1

/** A product with this browser's edits on top, and its version. */
export function laid<T extends { id: number }>(product: T, overlay: Overlay, created = false): T & Local {
  const edit = overlay.edits[product.id]
  return { ...product, ...edit?.changes, version: versionOf(overlay, product.id), ...(created ? { local: 'created' as const } : edit ? { local: 'edited' as const } : {}) }
}

/** Whether a product belongs in a list filtered this way. */
export const matches = (product: Pick<Product, 'title' | 'description' | 'category'>, { q, category }: Pick<Query, 'q' | 'category'>) =>
  (!category || product.category === category) && (!q || `${product.title} ${product.description}`.toLowerCase().includes(q.toLowerCase()))

/**
 * A page of the API's list as this browser sees it: deleted products gone, edited ones changed,
 * and the products created here first, on page 1. The API still pages by its own list, so a
 * page that lost a product is one short; the total follows what is known.
 */
export function layPage(remote: { items: Omit<Listed, keyof Local>[]; total: number }, overlay: Overlay, query: Query, pageSize: number): Page {
  const removed = new Set(overlay.removed)
  const kept = remote.items.filter((product) => !removed.has(product.id)).map((product) => laid(product, overlay))
  const created = overlay.created.filter((product) => matches(laid(product, overlay), query)).map(({ images: _, reviews: __, ...product }) => laid(product, overlay, true))
  const total = Math.max(remote.total - (remote.items.length - kept.length), kept.length) + created.length
  return {
    items: query.page === 1 ? [...created, ...kept] : kept,
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  }
}
