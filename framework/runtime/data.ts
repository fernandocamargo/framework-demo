/**
 * The data layer, on TanStack Query. Every service operation goes through it.
 *
 * - **Reads.** A service folder's `meta.ts` names the operations that read. Their results are
 *   cached under the service's path, the selected entity and the arguments
 *   (`['products.search', 'shop', { category: 'laptops' }]`).
 *   Calls in flight are shared.
 * - **Writes.** `meta.ts` names, by reference, the operations a write makes stale:
 *   `save: { invalidates: [services.products.search] }`. After the write succeeds,
 *   those reads refetch, and so does every component whose `async.ts` default export used them.
 * - **Components.** A component's `async.ts` default export runs as a query of its own. The
 *   framework records the reads it calls and the route parameters it reads, so nobody declares
 *   what a component depends on.
 * - **Failures** go to the error pipeline, tagged with the service's or component's path.
 */
import { QueryCache, QueryClient, hashKey, type Query } from '@tanstack/react-query'
import { hold } from './activity'
import { report } from './pipeline'

/** What a service folder's `meta.ts` says about one of its operations. */
export type ServiceRule = {
  /** The operation reads: its results are cached and shared. */
  reads?: boolean
  /** For a read: how long, in milliseconds, an answer is served again without asking. None by default. */
  freshFor?: number
  /** The operations this one makes stale when it succeeds, by reference. */
  invalidates?: unknown[]
}

type Operation = (...args: unknown[]) => unknown

const paths = new WeakMap<object, string>()

/** Names an operation by its path (`products.save`), so references can be resolved. */
export const name = (operation: object, path: string) => paths.set(operation, path)
export const pathOf = (operation: unknown) => (operation && (typeof operation === 'object' || typeof operation === 'function') ? paths.get(operation) : undefined)

type Tracking = {
  /** What each component query read, by query hash: service paths, and route parameters with their values. */
  dependencies: Map<string, { services: Set<string>; route: Map<string, unknown> }>
  /** The route parameters each component's default export reads, by component path. */
  routeKeys: Map<string, Set<string>>
}

/**
 * What the component queries of one query client read, kept as long as the client, so every
 * `Root` has its own. A query TanStack drops from its cache takes what it read with it.
 */
const trackings = new WeakMap<QueryClient, Tracking>()
function trackingOf(client: QueryClient): Tracking {
  let tracking = trackings.get(client)
  if (!tracking) {
    const created: Tracking = { dependencies: new Map(), routeKeys: new Map() }
    client.getQueryCache().subscribe((event) => {
      if (event.type === 'removed') created.dependencies.delete(event.query.queryHash)
    })
    trackings.set(client, (tracking = created))
  }
  return tracking
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (Object.prototype.toString.call(value) !== '[object Object]') return false
  const prototype = Object.getPrototypeOf(value) as unknown
  return prototype === Object.prototype || prototype === null
}

/** A list item's identity: its `id`, with its `type` when it has one. An item without an `id` has none. */
const identityOf = (item: unknown) =>
  isPlainObject(item) && (typeof item['id'] === 'string' || typeof item['id'] === 'number')
    ? `${typeof item['type'] === 'string' ? item['type'] : ''}:${String(item['id'])}`
    : undefined

/**
 * TanStack's structural sharing, with list items matched by identity, not by position. A
 * read keeps every part of its previous answer that equals the new one, so a component shown that
 * part gets the same object, and its memo skips it. TanStack matches a list's items by index, so
 * when a list comes back in another order (an edit moves a row down a sorted list),
 * every row that moved would be a new object. Here an item with an `id` is compared with the
 * previous item of the same `id` and `type`, wherever it was; an item without one, by position.
 */
export function shareByIdentity(previous: unknown, next: unknown): unknown {
  if (Object.is(previous, next)) return previous
  if (Array.isArray(previous) && Array.isArray(next)) {
    const earlier = new Map<string, unknown>()
    for (const item of previous as unknown[]) {
      const identity = identityOf(item)
      if (identity !== undefined && !earlier.has(identity)) earlier.set(identity, item)
    }
    let same = previous.length === next.length
    const shared = (next as unknown[]).map((item, index) => {
      const identity = identityOf(item)
      let match: unknown
      if (identity === undefined) match = previous[index]
      else if (earlier.has(identity)) {
        match = earlier.get(identity)
        earlier.delete(identity)
      }
      const result = match === undefined ? item : shareByIdentity(match, item)
      if (result !== previous[index]) same = false
      return result
    })
    return same ? previous : shared
  }
  if (isPlainObject(previous) && isPlainObject(next)) {
    const keys = Object.keys(next)
    let same = keys.length === Object.keys(previous).length
    const shared: Record<string, unknown> = {}
    for (const key of keys) {
      shared[key] = shareByIdentity(previous[key], next[key])
      if (!(key in previous) || shared[key] !== previous[key]) same = false
    }
    return same ? previous : shared
  }
  return next
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        const meta = query.meta as { service?: string; component?: string } | undefined
        if (meta?.service) report(error, { layer: 'service', path: meta.service })
        else report(error, { layer: 'async', ...(meta?.component ? { path: meta.component } : {}), during: 'default export' })
      },
    }),
    // A failure shows at once, and nothing is kept longer than TanStack's defaults. A
    // re-read keeps what did not change, matched by identity.
    defaultOptions: { queries: { retry: false, structuralSharing: shareByIdentity } },
  })
}

export type DataLayer = ReturnType<typeof createDataLayer>

export function createDataLayer(client: QueryClient, entity: { readonly id: string }) {
  const rules = new Map<string, ServiceRule>()
  // Per client, not per data layer: a change of entity makes a new data layer over the same cache,
  // and the queries of the entity before must still be made stale by the writes after.
  const { dependencies, routeKeys } = trackingOf(client)

  const invalidate = (operations: unknown[]) => {
    const targets = new Set(operations.map(pathOf).filter((path): path is string => Boolean(path)))
    if (!targets.size) return Promise.resolve()
    const stale = (query: Query) => {
      const [first] = query.queryKey
      if (typeof first === 'string' && targets.has(first)) return true
      const read = dependencies.get(query.queryHash)?.services
      return read ? [...read].some((path) => targets.has(path)) : false
    }
    // The client can outlive the pages, so a component off screen keeps its answer in the
    // cache, and a revisit shows it at once. One the write made stale is dropped instead, so a
    // revisit reads it anew rather than showing the answer from before the write; reading every
    // such answer again now would cost a request for each filter and page visited.
    client.removeQueries({ type: 'inactive', predicate: (query) => query.queryKey[0] === 'component' && stale(query) })
    return client.invalidateQueries({ predicate: stale })
  }

  return {
    client,
    /** Records what a service folder's `meta.ts` says, keyed by operation path. */
    rule(path: string, rule: ServiceRule) {
      rules.set(path, rule)
    },
    /** Runs a service operation through the data layer. */
    call(path: string, operation: Operation, args: unknown[]): Promise<unknown> {
      const rule = rules.get(path)
      if (rule?.reads) {
        return client.fetchQuery({
          queryKey: [path, entity.id, ...args],
          queryFn: () => operation(...args),
          meta: { service: path },
          ...(rule.freshFor ? { staleTime: rule.freshFor } : {}),
        })
      }
      // A write is pending until it and the reads it makes stale have settled.
      return hold(
        Promise.resolve()
          .then(() => operation(...args))
          .then(
            async (result) => {
              if (rule?.invalidates) await invalidate(rule.invalidates)
              return result
            },
            (error: unknown) => {
              throw report(error, { layer: 'service', path })
            },
          ),
      )
    },
    /**
     * The query of a component's `async.ts` default export. Its key holds the component's path,
     * the entity, and the route parameters its runs have read (learned on the first run), so a
     * different value is a different query: the component waits for it, and its failure reaches
     * the component's error file. Parameters it never read (an editor's `id`) do not rerun it.
     * Such a query stays fresh until a service it read is made stale (`invalidates`), or its key changes.
     */
    component(
      path: string,
      route: Record<string, unknown>,
      // `signal` is TanStack's: it aborts when nothing shows the read any more.
      run: (record: { service: (path: string) => void; route: (key: string, value: unknown) => void }, signal: AbortSignal) => Promise<unknown>,
    ) {
      const learned = routeKeys.get(path)
      const keyOf = (keys: Iterable<string>) => ['component', path, entity.id, Object.fromEntries([...keys].map((key) => [key, route[key]]))]
      const queryKey = learned ? keyOf(learned) : ['component', path, entity.id, null]
      return {
        queryKey,
        meta: { component: path },
        staleTime: Infinity,
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          const read = { services: new Set<string>(), route: new Map<string, unknown>() }
          dependencies.set(hashKey(queryKey), read)
          const data = await run({ service: (service) => read.services.add(service), route: (key, value) => read.route.set(key, value) }, signal)
          // The first run teaches which route parameters matter; its answer is kept under that
          // key too, so the next render finds it there.
          if (!learned) {
            routeKeys.set(path, new Set(read.route.keys()))
            const known = keyOf(read.route.keys())
            dependencies.set(hashKey(known), read)
            client.setQueryData(known, data)
          }
          return data
        },
      }
    },
  }
}

/**
 * The services, seen through a proxy that records each operation called. The proxy stands in
 * front of a blank object or function, not the tree itself: the tree's properties are read-only,
 * and a proxy of the tree would have to return them unwrapped.
 */
export function recording<T>(tree: T, record: (path: string) => void): T {
  // One proxy per node, so an operation read twice is the same function both times.
  const proxies = new WeakMap<object, unknown>()
  const wrap = (node: unknown): unknown => {
    if (!node || (typeof node !== 'object' && typeof node !== 'function')) return node
    if (proxies.has(node)) return proxies.get(node)
    // An arrow function has no `prototype`, so the proxy may report the tree's keys alone.
    const blank = typeof node === 'function' ? () => undefined : {}
    const proxy = new Proxy(blank, {
      get: (_, key) => wrap(Reflect.get(node as object, key)),
      has: (_, key) => Reflect.has(node as object, key),
      ownKeys: () => Reflect.ownKeys(node as object).filter((key) => key !== 'prototype' && key !== 'length' && key !== 'name' && key !== 'arguments' && key !== 'caller'),
      getOwnPropertyDescriptor: (_, key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(node as object, key)
        return descriptor && { ...descriptor, configurable: true }
      },
      apply: (_, self, args) => {
        const path = pathOf(node)
        if (path) record(path)
        return Reflect.apply(node as Operation, self, args)
      },
    })
    proxies.set(node, proxy)
    return proxy
  }
  return wrap(tree) as T
}

/** The route, seen through a proxy that records each parameter read, with its value. */
export function recordingRoute<T extends object>(route: T, record: (key: string, value: unknown) => void): T {
  return new Proxy(route, {
    get: (target, key) => {
      const value = Reflect.get(target, key)
      if (typeof key === 'string') record(key, value)
      return value
    },
  })
}
