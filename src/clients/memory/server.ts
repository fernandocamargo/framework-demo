// DummyJSON, answered in memory: the endpoints this app calls, with the same paths, parameters,
// statuses and messages, including its `delay` parameter and its `/http/<status>` helper. Like
// DummyJSON, it echoes writes and keeps nothing.
import type { Product } from '@/services/products/types'
import { sleep } from '../storage'
import type { Wire } from '../dummyjson/http'
import * as fixtures from './fixtures'

type Data = { products: Product[]; categories: { slug: string; name: string }[]; user: typeof fixtures.user }

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export function createServer({ data = fixtures as Data, now = Date.now }: { data?: Data; now?: () => number } = {}): Wire {
  let issued = 0
  const tokens = (minutes: number) => ({
    accessToken: `access.${data.user.id}.${now() + minutes * 60_000}`,
    refreshToken: `refresh.${data.user.id}.${(issued += 1)}`,
  })
  const signedIn = (init: RequestInit) => {
    const [, token = ''] = /^Bearer (.+)$/.exec(new Headers(init.headers).get('authorization') ?? '') ?? []
    const [kind, , expiresAt, extra] = token.split('.')
    return kind === 'access' && extra === undefined && Number(expiresAt) > now()
  }

  const page = (items: Product[], query: URLSearchParams) => {
    const sortBy = query.get('sortBy') as keyof Product | null
    const sorted = sortBy
      ? [...items].sort((a, b) => {
          const [x, y] = [a[sortBy], b[sortBy]]
          const order = typeof x === 'string' ? x.localeCompare(String(y)) : Number(x) - Number(y)
          return query.get('order') === 'desc' ? -order : order
        })
      : items
    const skip = Number(query.get('skip') ?? 0)
    const limit = Number(query.get('limit') ?? 30) || sorted.length
    const fields = query.get('select')?.split(',')
    const selected = sorted.slice(skip, skip + limit).map((product) => select(product, fields))
    return { products: selected, total: items.length, skip, limit: selected.length }
  }
  const select = (product: Product, fields?: string[]) =>
    fields ? Object.fromEntries([['id', product.id], ...fields.filter((field) => field in product).map((field) => [field, product[field as keyof Product]])]) : product

  const route = (method: string, path: string, query: URLSearchParams, body: Record<string, unknown>, init: RequestInit): Response => {
    const status = /^\/http\/(\d{3})$/.exec(path)
    if (status) return json(Number(status[1]), { status: status[1], title: 'Forced by the network lab', message: `The server answered ${status[1]}.` })

    if (path === '/auth/login' && method === 'POST') {
      if (body['username'] !== data.user.username || body['password'] !== data.user.password) return json(400, { message: 'Invalid credentials' })
      const { password: _, ...user } = data.user
      return json(200, { ...user, ...tokens(Number(body['expiresInMins'] ?? 60)) })
    }
    if (path === '/auth/refresh' && method === 'POST') {
      if (!/^refresh\.\d+\.\d+$/.test(String(body['refreshToken']))) return json(403, { message: 'Invalid refresh token' })
      return json(200, tokens(Number(body['expiresInMins'] ?? 60)))
    }
    const needsToken = path.startsWith('/auth/')
    if (needsToken && !signedIn(init)) return json(401, { message: 'Invalid/Expired Token!' })
    if (path === '/auth/me' && method === 'GET') {
      const { password: _, ...user } = data.user
      return json(200, user)
    }
    const resource = needsToken ? path.slice('/auth'.length) : path

    if (method === 'GET' && resource === '/products') return json(200, page(data.products, query))
    if (method === 'GET' && resource === '/products/categories') return json(200, data.categories)
    if (method === 'GET' && resource === '/products/search') {
      const q = (query.get('q') ?? '').toLowerCase()
      return json(200, page(data.products.filter((product) => `${product.title} ${product.description}`.toLowerCase().includes(q)), query))
    }
    const category = /^\/products\/category\/([\w-]+)$/.exec(resource)
    if (method === 'GET' && category) return json(200, page(data.products.filter((product) => product.category === category[1]), query))
    if (method === 'POST' && resource === '/products/add') return json(201, { id: data.products.length + 1, ...body })

    const one = /^\/products\/(\d+)$/.exec(resource)
    const product = one && data.products.find((candidate) => candidate.id === Number(one[1]))
    if (one && !product) return json(404, { message: `Product with id '${one[1]}' not found` })
    if (product && method === 'GET') return json(200, select(product, query.get('select')?.split(',')))
    if (product && method === 'PUT') return json(200, { ...product, ...body })
    if (product && method === 'DELETE') return json(200, { ...product, isDeleted: true, deletedOn: new Date(now()).toISOString() })
    return json(404, { message: `No route for ${method} ${path}` })
  }

  return async (address, init) => {
    const url = new URL(address)
    const delay = Math.min(Number(url.searchParams.get('delay') ?? 0), 5000)
    if (delay) await sleep(delay, init.signal ?? undefined)
    init.signal?.throwIfAborted()
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {}
    return route(init.method ?? 'GET', url.pathname, url.searchParams, body, init)
  }
}
