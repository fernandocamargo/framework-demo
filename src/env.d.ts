// What this app injects, as the framework's interfaces. main.tsx gives the values to `Root`.
import 'framework'
import type { SortKey } from './services/products/types'

declare module 'framework' {
  interface Env {
    /** Which world the app sees: DummyJSON over the network, or the same API answered in memory. */
    world: 'dummyjson' | 'memory'
    /** Where DummyJSON answers. */
    apiUrl: string
  }
  /** Reads are cached under the entity's `id`. Here it is the world, so two worlds never share an answer. */
  interface Entity {
    id: string
  }
  /**
   * The address, parsed (src/address.ts). The catalogue's filters and every open dialog live in
   * it, so a reload, a shared link and the back button keep them. A component's read is keyed
   * by the fields it reads, and only those.
   */
  interface Route {
    q: string
    category: string
    sort: SortKey
    order: 'asc' | 'desc'
    page: number
    /** The product whose details show. */
    view: number | null
    /** The product being edited. */
    edit: number | null
    /** Whether a new product is being written. */
    create: boolean
    /** The product whose deletion is being confirmed. */
    remove: number | null
    /** Whether the bulk price change is open. */
    bulk: boolean
    /** Whether the sign-in dialog was asked for. */
    signin: boolean
  }
  /** Who is signed in, from the profile the session names (`/auth/me`): DummyJSON's own user, with its role. */
  interface User {
    id: number
    username: string
    firstName: string
    lastName: string
    image: string
  }
  /**
   * What the backend says may be done (`/auth/permissions`): a snapshot the app does not own.
   * Components get it as `acl`, with `allowed` on it, and test their rules against it.
   */
  interface Acl {
    role: 'admin' | 'moderator' | 'user' | 'guest'
    grants: { products: ('read' | 'create' | 'update' | 'delete')[]; prices: 'update'[] }
    /** The largest price change one may apply, in percent; null for no limit. */
    limits: { priceChange: number | null }
  }
  interface Navigation {
    /** Changes these fields of the address and keeps the others. */
    go(changes: Partial<Route>): void
  }
}
