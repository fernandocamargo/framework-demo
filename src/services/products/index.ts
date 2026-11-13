// The catalogue's operations. Reads ask DummyJSON and lay the local overlay over the answer.
// Writes go to DummyJSON first, signed in, so the network and the session are exercised for
// real; DummyJSON echoes them and keeps nothing, so the overlay keeps them (clients/local).
// The services' meta.ts says which of these read and what each write makes stale.
import { isLocal } from '@/clients/local'
import { laid, layPage, PAGE_SIZE } from './overlay'
import type { Category, Changes, Detailed, Listed, Local, Page, Product, Query, Review } from './types'

const LISTED = 'title,description,category,brand,price,stock,rating,thumbnail'

type Listing = { products: Omit<Listed, keyof Local>[]; total: number }

class NotFoundError extends Error {
  override name = 'NotFoundError'
}

/** A page of products, filtered and sorted as the query says. */
export const search =
  ({ clients: { api, local } }) =>
  async (query: Query): Promise<Page> => {
    const skip = (query.page - 1) * PAGE_SIZE
    const sorting = { sortBy: query.sort, order: query.order, select: LISTED }
    // DummyJSON filters by a category or by text, not both: within a category, the text is
    // matched here, over the whole category.
    const remote = query.category
      ? api.get<Listing>(`/products/category/${encodeURIComponent(query.category)}`, { query: { ...sorting, limit: 0 } }).then(({ products }) => {
          const found = products.filter((product) => !query.q || `${product.title} ${product.description}`.toLowerCase().includes(query.q.toLowerCase()))
          return { items: found.slice(skip, skip + PAGE_SIZE), total: found.length }
        })
      : api
          .get<Listing>(query.q ? '/products/search' : '/products', { query: { ...sorting, q: query.q, limit: PAGE_SIZE, skip } })
          .then(({ products, total }) => ({ items: products, total }))
    const [answer, overlay] = await Promise.all([remote, local.read()])
    return layPage(answer, overlay, query, PAGE_SIZE)
  }

/** One product, with its pictures. */
export const get =
  ({ clients: { api, local } }) =>
  async (id: number): Promise<Detailed> => {
    const overlay = await local.read()
    if (overlay.removed.includes(id)) throw new NotFoundError('This product was deleted.')
    if (isLocal(id)) {
      const created = overlay.created.find((product) => product.id === id)
      if (!created) throw new NotFoundError('This product no longer exists.')
      const { reviews: _, ...product } = created
      return laid(product, overlay, true)
    }
    return laid(await api.get<Omit<Product, 'reviews'>>(`/products/${id}`, { query: { select: `${LISTED},images` } }), overlay)
  }

/** A product's reviews. A product created here has none. */
export const reviews =
  ({ clients: { api } }) =>
  async (id: number): Promise<Review[]> =>
    isLocal(id) ? [] : (await api.get<{ reviews: Review[] }>(`/products/${id}`, { query: { select: 'reviews' } })).reviews

export const categories =
  ({ clients: { api } }) =>
  () =>
    api.get<Category[]>('/products/categories')

/**
 * Saves a person's changes to the version of the product they started from. Rejects with a
 * `ConflictError` when the product has a newer version: somebody else saved meanwhile.
 */
export const save =
  ({ clients: { api, local } }) =>
  async ({ id, changes, version }: { id: number; changes: Partial<Changes>; version?: number }): Promise<{ id: number; version: number }> => {
    // A product created here exists only here: the API is still asked who is signed in.
    if (isLocal(id)) await api.get('/auth/me', { auth: true })
    else await api.put(`/auth/products/${id}`, changes, { auth: true })
    return { id, version: await local.edit(id, changes, version) }
  }

export const create =
  ({ clients: { api, local } }) =>
  async (changes: Changes): Promise<Product> => {
    await api.post('/auth/products/add', changes, { auth: true })
    return local.create({ ...changes, rating: 0, thumbnail: '', images: [], reviews: [] })
  }

/**
 * Sets a product's stock, whatever its version: a count taken in the stockroom, not an edit of
 * what somebody else saved. Each press of a row's buttons sends one, with the count the row shows.
 */
export const setStock =
  ({ clients: { api, local } }) =>
  async ({ id, stock }: { id: number; stock: number }): Promise<{ id: number; version: number }> => {
    if (isLocal(id)) await api.get('/auth/me', { auth: true })
    else await api.put(`/auth/products/${id}`, { stock }, { auth: true })
    return { id, version: await local.edit(id, { stock }) }
  }

export const remove =
  ({ clients: { api, local } }) =>
  async (id: number): Promise<void> => {
    if (isLocal(id)) await api.get('/auth/me', { auth: true })
    else await api.delete(`/auth/products/${id}`, { auth: true })
    await local.remove(id)
  }

/** Somebody else's save, for the network lab: the product's last unit is sold, and its version moves on. */
export const sellOut =
  ({ clients: { local } }) =>
  async (id: number): Promise<void> => {
    await local.edit(id, { stock: 0 })
  }

/** Forgets every local change. */
export const reset =
  ({ clients: { local } }) =>
  () =>
    local.reset()
