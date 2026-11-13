// What a backend would answer at `GET /auth/permissions`: the grants and limits of the person
// the access token names, or a guest's without one. DummyJSON has no such endpoint, so both worlds
// answer it from here: the memory world's server, and a layer over DummyJSON's wire. The app never
// imports this file; it reads whatever the API answers, and tests its own rules against it.
export type Permissions = {
  role: 'admin' | 'moderator' | 'user' | 'guest'
  grants: { products: ('read' | 'create' | 'update' | 'delete')[]; prices: 'update'[] }
  /** The largest price change one may apply, in percent; null for no limit. */
  limits: { priceChange: number | null }
}

const BY_ROLE: Record<Permissions['role'], Omit<Permissions, 'role'>> = {
  admin: { grants: { products: ['read', 'create', 'update', 'delete'], prices: ['update'] }, limits: { priceChange: null } },
  moderator: { grants: { products: ['read', 'create', 'update'], prices: ['update'] }, limits: { priceChange: 20 } },
  user: { grants: { products: ['read'], prices: [] }, limits: { priceChange: 0 } },
  guest: { grants: { products: ['read'], prices: [] }, limits: { priceChange: 0 } },
}

export const permissionsOf = (role: string | null): Permissions => {
  const known = role && role in BY_ROLE ? (role as Permissions['role']) : 'guest'
  return { role: known, ...structuredClone(BY_ROLE[known]) }
}

const PATH = /\/auth\/permissions(?:\?|$)/

/**
 * A wire that answers `/auth/permissions` itself, from the role `/auth/me` gives for the same
 * token, and passes every other request through. A refused token is refused here too, so the
 * client refreshes it as for any other request.
 */
export const withPermissions =
  (wire: (url: string, init: RequestInit) => Promise<Response>) =>
  async (url: string, init: RequestInit): Promise<Response> => {
    if (!PATH.test(new URL(url).pathname + new URL(url).search)) return wire(url, init)
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (!new Headers(init.headers).get('authorization')) return json(200, permissionsOf(null))
    const me = await wire(url.replace(/\/auth\/permissions/, '/auth/me'), { ...init, method: 'GET' })
    if (!me.ok) return me
    const { role } = (await me.json()) as { role?: string }
    return json(200, permissionsOf(role ?? null))
  }
