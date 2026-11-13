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
 * - **Optimistic writes.** `meta.ts` may also say how a write changes the answers of some reads
 *   (`optimistic: [update(products.get, (product, change) => …)]`). Those answers change when the
 *   write is sent, and so do the components that showed them. Each write sent and not yet settled
 *   is kept, in order, over the server's last answer: an answer that arrives meanwhile gets them
 *   again, and a write that fails is taken out, the others staying (a rebase, not a restore).
 * - **Other tabs.** With a channel open (`Root`'s `sync`), a write that succeeds tells the other
 *   tabs of the app which reads it made stale, by path, and they read them again.
 * - **What it does** goes to the pipelines as `data` events (pipeline.ts), for an inspector.
 * - **Components.** A component's `async.ts` default export runs as a query of its own. The
 *   framework records the reads it calls and the route parameters it reads, so nobody declares
 *   what a component depends on.
 * - **Failures** go to the error pipeline, tagged with the service's or component's path.
 */
import { QueryCache, QueryClient, hashKey, type Query } from '@tanstack/react-query'
import { hold } from './activity'
import { emitData, report } from './pipeline'
import { activeInteraction } from './track'

/** What a service folder's `meta.ts` says about one of its operations. */
export type ServiceRule = {
  /** The operation reads: its results are cached and shared. */
  reads?: boolean
  /** For a read: how long, in milliseconds, an answer is served again without asking. None by default. */
  freshFor?: number
  /** The operations this one makes stale when it succeeds, by reference. */
  invalidates?: unknown[]
  /** The reads this write changes when it is sent, before the server confirms it, each with how. */
  optimistic?: readonly Update[]
}

/** One read a write changes when it is sent, and how: `update(products.get, (product, change) => …)`. */
export type Update<Args extends unknown[] = never[]> = { readonly read: unknown; readonly change: (answer: never, ...args: Args) => unknown }

/**
 * Pairs a read with how a write changes its answers, for a `meta.ts`'s `optimistic`. The answer
 * is typed by the read, the arguments by the write.
 */
export function update<Read extends (...args: never[]) => Promise<unknown>, Args extends unknown[]>(
  read: Read,
  change: (answer: Awaited<ReturnType<Read>>, ...args: Args) => Awaited<ReturnType<Read>>,
): Update<Args> {
  return { read, change: change as Update<Args>['change'] }
}

type Operation = (...args: unknown[]) => unknown

const paths = new WeakMap<object, string>()

/** Names an operation by its path (`products.save`), so references can be resolved. */
export const name = (operation: object, path: string) => paths.set(operation, path)
export const pathOf = (operation: unknown) => (operation && (typeof operation === 'object' || typeof operation === 'function') ? paths.get(operation) : undefined)

/** A read's answer from the cache, without asking: what a component's answer is worked out from again. */
export type Peek = (path: string, args: unknown[]) => { data: unknown } | undefined

/** A write sent and not settled, with the reads it changes. */
type Sent = { changes: { path: string; change: (answer: unknown, ...args: unknown[]) => unknown }[]; args: unknown[] }

type Tracking = {
  /** What each component query read, by query hash: service paths, and route parameters with their values. */
  dependencies: Map<string, { services: Set<string>; route: Map<string, unknown> }>
  /** The route parameters each component's default export reads, by component path. */
  routeKeys: Map<string, Set<string>>
  /** The optimistic writes sent and not settled, in the order they were sent. */
  sent: Sent[]
  /** The server's last answer, by query hash, for each read a write in `sent` changes. */
  confirmed: Map<string, unknown>
  /** How to work out each component query's answer again from the cache alone, by query hash. */
  derivers: Map<string, (peek: Peek) => Promise<unknown>>
  /** The channel to the app's other tabs, while one is open. */
  channel: BroadcastChannel | null
}

/**
 * What the component queries of one query client read, kept as long as the client, so every
 * `Root` has its own. A query TanStack drops from its cache takes what it read with it.
 */
const trackings = new WeakMap<QueryClient, Tracking>()
function trackingOf(client: QueryClient): Tracking {
  let tracking = trackings.get(client)
  if (!tracking) {
    const created: Tracking = { dependencies: new Map(), routeKeys: new Map(), sent: [], confirmed: new Map(), derivers: new Map(), channel: null }
    client.getQueryCache().subscribe((event) => {
      if (event.type !== 'removed') return
      created.dependencies.delete(event.query.queryHash)
      created.derivers.delete(event.query.queryHash)
      created.confirmed.delete(event.query.queryHash)
    })
    trackings.set(client, (tracking = created))
  }
  return tracking
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (Object.prototype.toString.call(value) !== '[object Object]') return false
  // A React element is a plain object too, but not one to take apart.
  if ('$$typeof' in (value as object)) return false
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
  const tracking = trackingOf(client)
  const { dependencies, routeKeys, sent, confirmed, derivers } = tracking
  const paths = (operations: readonly unknown[]) => new Set(operations.map(pathOf).filter((path): path is string => Boolean(path)))

  /** An answer of the read at `path` with every write sent that changes it laid over it, in order. */
  const laidOver = (path: string, answer: unknown, writes: readonly Sent[] = sent) =>
    writes.reduce((data, write) => write.changes.reduce((each, { path: read, change }) => (read === path ? change(each, ...write.args) : each), data), answer)
  const changes = (write: Sent, path: string) => write.changes.some((change) => change.path === path)

  /**
   * What a read shows when the server answers it: the answer, with the writes sent and not settled
   * laid over it. The answer itself is kept, for when one of them fails.
   */
  const shownOf = (hash: string, path: string, answer: unknown) => {
    if (!sent.some((write) => changes(write, path))) {
      confirmed.delete(hash)
      return answer
    }
    confirmed.set(hash, answer)
    return laidOver(path, answer)
  }

  const peek: Peek = (path, args) => {
    const data = client.getQueryData([path, entity.id, ...args])
    return data === undefined ? undefined : { data }
  }
  const latest = new Map<string, number>()
  /** Works the components' answers out again from the cache, for those that read one of these. */
  const rederive = (targets: Set<string>) => {
    for (const query of client.getQueryCache().getAll()) {
      // Only what is on screen: one off screen is read anew when it shows again.
      if (query.queryKey[0] !== 'component' || query.state.data === undefined || query.getObserversCount() === 0) continue
      const read = dependencies.get(query.queryHash)?.services
      const derive = derivers.get(query.queryHash)
      if (!read || !derive || ![...read].some((path) => targets.has(path))) continue
      const turn = (latest.get(query.queryHash) ?? 0) + 1
      latest.set(query.queryHash, turn)
      void hold(
        derive(peek).then(
          (data) => {
            // Only the last of several, for one that was worked out again meanwhile.
            if (latest.get(query.queryHash) !== turn) return
            client.setQueryData(query.queryKey, data)
            emitData({ action: 'derive', path: String(query.queryKey[1]), reads: [...read].filter((path) => targets.has(path)) })
          },
          () => undefined,
        ),
      )
    }
  }
  /** Shows the reads at these paths as the server's last answers, with the writes sent laid over them, and the components that read them. */
  const reshow = (targets: Set<string>) => {
    for (const query of client.getQueryCache().getAll()) {
      const [path] = query.queryKey
      if (typeof path !== 'string' || !targets.has(path) || query.state.data === undefined) continue
      const base = confirmed.has(query.queryHash) ? confirmed.get(query.queryHash) : query.state.data
      client.setQueryData(query.queryKey, shownOf(query.queryHash, path, base))
    }
    rederive(targets)
  }

  /** Makes the reads at these paths stale, and every component that read one; `by` is the write's path. */
  const invalidatePaths = (targets: Set<string>, by: string, fromTab = false) => {
    if (!targets.size) return Promise.resolve()
    emitData({ action: 'stale', path: by, reads: [...targets], ...(fromTab ? { outcome: 'received' as const } : {}) })
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
    /**
     * Opens the channel to the app's other tabs: a write that succeeds here makes the same reads
     * stale there, and theirs here. Returns what closes it.
     */
    share(name: string) {
      if (typeof BroadcastChannel === 'undefined') return () => undefined
      const channel = new BroadcastChannel(name)
      tracking.channel = channel
      channel.onmessage = (event: MessageEvent<{ invalidate?: unknown; by?: unknown }>) => {
        const stale = event.data?.invalidate
        if (!Array.isArray(stale)) return
        const reads = stale.filter((path): path is string => typeof path === 'string')
        const by = typeof event.data.by === 'string' ? event.data.by : 'another tab'
        emitData({ action: 'tab', path: by, outcome: 'received', reads })
        void hold(invalidatePaths(new Set(reads), by, true))
      }
      return () => {
        channel.close()
        if (tracking.channel === channel) tracking.channel = null
      }
    },
    /** Records what a service folder's `meta.ts` says, keyed by operation path. */
    rule(path: string, rule: ServiceRule) {
      rules.set(path, rule)
    },
    /** Runs a service operation through the data layer. */
    call(path: string, operation: Operation, args: unknown[]): Promise<unknown> {
      const rule = rules.get(path)
      if (rule?.reads) {
        const queryKey = [path, entity.id, ...args]
        return client.fetchQuery({
          queryKey,
          // The answer with the writes sent laid over it, so a read that lands while a write is
          // on its way does not undo what the write shows.
          queryFn: async () => {
            const started = performance.now()
            const answer = await operation(...args)
            emitData({ action: 'read', path, ms: Math.round(performance.now() - started) })
            return shownOf(hashKey(queryKey), path, answer)
          },
          meta: { service: path },
          ...(rule.freshFor ? { staleTime: rule.freshFor } : {}),
        })
      }
      // The interaction whose handler sent it, if one did: its handler is running now.
      const cause = activeInteraction()?.id
      const started = performance.now()
      emitData({ action: 'write', path, outcome: 'sent', ...(cause === undefined ? {} : { cause }) })
      // An optimistic write shows its changes now, over every answer of the reads it changes.
      const write: Sent | null = rule?.optimistic?.length
        ? { changes: rule.optimistic.flatMap(({ read, change }) => (pathOf(read) ? [{ path: pathOf(read)!, change: change as Sent['changes'][number]['change'] }] : [])), args }
        : null
      const changed = new Set(write?.changes.map((change) => change.path))
      if (write) {
        sent.push(write)
        reshow(changed)
        emitData({ action: 'optimistic', path, reads: [...changed] })
      }
      const settle = () => {
        if (write) sent.splice(sent.indexOf(write), 1)
      }
      // A write is pending until it and the reads it makes stale have settled.
      return hold(
        Promise.resolve()
          .then(() => operation(...args))
          .then(
            async (result) => {
              // The server took it: the answers kept for a rollback take it too, until the reads
              // it changed and those it makes stale are read again.
              if (write) {
                for (const query of client.getQueryCache().getAll()) {
                  const [read] = query.queryKey
                  if (typeof read === 'string' && changed.has(read) && confirmed.has(query.queryHash)) confirmed.set(query.queryHash, laidOver(read, confirmed.get(query.queryHash), [write]))
                }
                settle()
              }
              emitData({ action: 'write', path, outcome: 'done', ms: Math.round(performance.now() - started) })
              const stale = new Set([...paths(rule?.invalidates ?? []), ...changed])
              if (tracking.channel && stale.size) {
                tracking.channel.postMessage({ invalidate: [...stale], by: path })
                emitData({ action: 'tab', path, outcome: 'sent', reads: [...stale] })
              }
              if (stale.size) await invalidatePaths(stale, path)
              return result
            },
            (error: unknown) => {
              emitData({ action: 'write', path, outcome: 'failed', ms: Math.round(performance.now() - started) })
              // A rebase: the server's answers again, with the writes still on their way over them.
              if (write) {
                settle()
                reshow(changed)
                emitData({ action: 'rollback', path, reads: [...changed] })
              }
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
      // With `peek`, the reads answer from the cache: the answer is worked out again, not read again.
      run: (record: { service: (path: string) => void; route: (key: string, value: unknown) => void; peek?: Peek }, signal: AbortSignal) => Promise<unknown>,
      // What else the read depends on, besides the route: the locale or the user it reads.
      sources?: Record<string, unknown>,
    ) {
      const learned = routeKeys.get(path)
      const keyOf = (keys: Iterable<string>) => ['component', path, entity.id, Object.fromEntries([...keys].map((key) => [key, route[key]])), ...(sources ? [sources] : [])]
      const queryKey = learned ? keyOf(learned) : ['component', path, entity.id, null, ...(sources ? [sources] : [])]
      return {
        queryKey,
        meta: { component: path },
        staleTime: Infinity,
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          const read = { services: new Set<string>(), route: new Map<string, unknown>() }
          dependencies.set(hashKey(queryKey), read)
          // An optimistic write works this answer out again from the cache, with what it changed.
          const derive = (peek: Peek) => run({ service: () => undefined, route: () => undefined, peek }, new AbortController().signal)
          derivers.set(hashKey(queryKey), derive)
          const started = performance.now()
          const data = await run({ service: (service) => read.services.add(service), route: (key, value) => read.route.set(key, value) }, signal)
          emitData({ action: 'read', path, reads: [...read.services], ms: Math.round(performance.now() - started) })
          // The first run teaches which route parameters matter; its answer is kept under that
          // key too, so the next render finds it there.
          if (!learned) {
            routeKeys.set(path, new Set(read.route.keys()))
            const known = keyOf(read.route.keys())
            dependencies.set(hashKey(known), read)
            derivers.set(hashKey(known), derive)
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
export function recording<T>(tree: T, record: (path: string) => void, peek?: Peek): T {
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
        // Worked out again from the cache: a read it holds answers without asking.
        const cached = path && peek ? peek(path, args) : undefined
        if (cached) return Promise.resolve(cached.data)
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
