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

import { hashKey, notifyManager, type Query, QueryCache, QueryClient } from '@tanstack/react-query';

import { hold } from './activity';
import { emitData, isAbortError, report } from './pipeline';
import { activeInteraction } from './track';

// Background tabs throttle timers; deliver query changes before the page can report itself idle.
notifyManager.setScheduler(queueMicrotask);

/** What a service folder's `meta.ts` says about one of its operations. */
export type ServiceRule = {
  /**
   * For a read whose source can change outside the app (a flag provider's push, a socket): calls
   * `stale` whenever it does, and the read and every component that read it are read again.
   * Called once, when the rules are read; what it returns, if anything, stops it.
   */
  follows?: (stale: () => void) => (() => void) | void;
  /** For a read: how long, in milliseconds, an answer is served again without asking. None by default. */
  freshFor?: number;
  /** The operations this one makes stale when it succeeds, by reference. */
  invalidates?: unknown[];
  /** The reads this write changes when it is sent, before the server confirms it, each with how. */
  optimistic?: readonly Update[];
  /** The operation reads: its results are cached and shared. */
  reads?: boolean;
};

/** One read a write changes when it is sent, and how: `update(products.get, (product, change) => …)`. */
export type Update<Args extends unknown[] = never[]> = {
  readonly change: (answer: never, ...args: Args) => unknown;
  readonly read: unknown;
};

/**
 * Pairs a read with how a write changes its answers, for a `meta.ts`'s `optimistic`. The answer
 * is typed by the read, the arguments by the write.
 */
export function update<Read extends (...args: never[]) => Promise<unknown>, Args extends unknown[]>(
  read: Read,
  change: (answer: Awaited<ReturnType<Read>>, ...args: Args) => Awaited<ReturnType<Read>>,
): Update<Args> {
  return { change: change as Update<Args>['change'], read };
}

type Operation = (...args: unknown[]) => unknown;

const paths = new WeakMap<object, string>();

/** Names an operation by its path (`products.save`), so references can be resolved. */
export const name = (operation: object, path: string) => paths.set(operation, path);
export const pathOf = (operation: unknown) =>
  operation && (typeof operation === 'object' || typeof operation === 'function') ? paths.get(operation) : undefined;

/** A read's answer from the cache, without asking: what a component's answer is worked out from again. */
export type Peek = (path: string, args: unknown[]) => undefined | { data: unknown };

/** A write sent and not settled, with the reads it changes. */
type Sent = { args: unknown[]; changes: { change: (answer: unknown, ...args: unknown[]) => unknown; path: string }[] };

type Tracking = {
  /** The channel to the app's other tabs, while one is open. */
  channel: BroadcastChannel | null;
  /** The server's last answer, by query hash, for each read a write in `sent` changes. */
  confirmed: Map<string, unknown>;
  /** What each component query read, by query hash: service paths, and route parameters with their values. */
  dependencies: Map<string, { route: Map<string, unknown>; services: Set<string> }>;
  /** How to work out each component query's answer again from the cache alone, by query hash. */
  derivers: Map<string, (peek: Peek) => Promise<unknown>>;
  /** The route parameters each component's default export reads, by component path. */
  routeKeys: Map<string, Set<string>>;
  /** The optimistic writes sent and not settled, in the order they were sent. */
  sent: Sent[];
};

/**
 * What the component queries of one query client read, kept as long as the client, so every
 * `Root` has its own. A query TanStack drops from its cache takes what it read with it.
 */
const trackings = new WeakMap<QueryClient, Tracking>();
function trackingOf(client: QueryClient): Tracking {
  let tracking = trackings.get(client);
  if (!tracking) {
    const created: Tracking = {
      channel: null,
      confirmed: new Map(),
      dependencies: new Map(),
      derivers: new Map(),
      routeKeys: new Map(),
      sent: [],
    };
    client.getQueryCache().subscribe((event) => {
      if (event.type !== 'removed') return;
      created.dependencies.delete(event.query.queryHash);
      created.derivers.delete(event.query.queryHash);
      created.confirmed.delete(event.query.queryHash);
    });
    trackings.set(client, (tracking = created));
  }
  return tracking;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (Object.prototype.toString.call(value) !== '[object Object]') return false;
  // A React element is a plain object too, but not one to take apart.
  if ('$$typeof' in (value as object)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};

/** A list item's identity: its `id`, with its `type` when it has one. An item without an `id` has none. */
const identityOf = (item: unknown) =>
  isPlainObject(item) && (typeof item['id'] === 'string' || typeof item['id'] === 'number')
    ? `${typeof item['type'] === 'string' ? item['type'] : ''}:${String(item['id'])}`
    : undefined;

/**
 * TanStack's structural sharing, with list items matched by identity, not by position. A
 * read keeps every part of its previous answer that equals the new one, so a component shown that
 * part gets the same object, and its memo skips it. TanStack matches a list's items by index, so
 * when a list comes back in another order (an edit moves a row down a sorted list),
 * every row that moved would be a new object. Here an item with an `id` is compared with the
 * previous item of the same `id` and `type`, wherever it was; an item without one, by position.
 */
export function shareByIdentity(previous: unknown, next: unknown): unknown {
  if (Object.is(previous, next)) return previous;
  if (Array.isArray(previous) && Array.isArray(next)) {
    const earlier = new Map<string, unknown>();
    for (const item of previous as unknown[]) {
      const identity = identityOf(item);
      if (identity !== undefined && !earlier.has(identity)) earlier.set(identity, item);
    }
    let same = previous.length === next.length;
    const shared = (next as unknown[]).map((item, index) => {
      const identity = identityOf(item);
      let match: unknown;
      if (identity === undefined) match = previous[index];
      else if (earlier.has(identity)) {
        match = earlier.get(identity);
        earlier.delete(identity);
      }
      const result = match === undefined ? item : shareByIdentity(match, item);
      if (result !== previous[index]) same = false;
      return result;
    });
    return same ? previous : shared;
  }
  if (isPlainObject(previous) && isPlainObject(next)) {
    const keys = Object.keys(next);
    let same = keys.length === Object.keys(previous).length;
    const shared: Record<string, unknown> = {};
    for (const key of keys) {
      shared[key] = shareByIdentity(previous[key], next[key]);
      if (!(key in previous) || shared[key] !== previous[key]) same = false;
    }
    return same ? previous : shared;
  }
  return next;
}

export function createQueryClient() {
  return new QueryClient({
    // A failure shows at once, and nothing is kept longer than TanStack's defaults. A
    // re-read keeps what did not change, matched by identity.
    defaultOptions: { queries: { retry: false, structuralSharing: shareByIdentity } },
    queryCache: new QueryCache({
      onError: (error, query) => {
        const meta = query.meta as undefined | { component?: string; service?: string };
        if (meta?.service) report(error, { layer: 'service', path: meta.service });
        else
          report(error, {
            layer: 'async',
            ...(meta?.component ? { path: meta.component } : {}),
            during: 'default export',
          });
      },
    }),
  });
}

export type DataLayer = ReturnType<typeof createDataLayer>;

/** Who waits for the next message from another tab to be handled. */
const waiting = new Set<() => void>();
/**
 * Resolves once the data layer has handled the next message from another tab, after which
 * `whenIdle()` waits for what it made stale. For tests that drive two tabs: each channel object
 * of a page hears a message in its own time, so a test's own channel says nothing about the app's.
 * It is also `window.__framework.fromTab()`.
 */
export const fromTab = () => new Promise<void>((resolve) => waiting.add(resolve));

if (typeof window !== 'undefined') {
  const global = window as { __framework?: Record<string, unknown> };
  global.__framework = { ...global.__framework, fromTab };
}

export function createDataLayer(client: QueryClient, entity: { readonly id: string }) {
  const rules = new Map<string, ServiceRule>();
  // Per client, not per data layer: a change of entity makes a new data layer over the same cache,
  // and the queries of the entity before must still be made stale by the writes after.
  const tracking = trackingOf(client);
  const { confirmed, dependencies, derivers, routeKeys, sent } = tracking;
  const paths = (operations: readonly unknown[]) =>
    new Set(operations.map(pathOf).filter((path): path is string => Boolean(path)));

  /** An answer of the read at `path` with every write sent that changes it laid over it, in order. */
  const laidOver = (path: string, answer: unknown, writes: readonly Sent[] = sent) =>
    writes.reduce(
      (data, write) =>
        write.changes.reduce(
          (each, { change, path: read }) => (read === path ? change(each, ...write.args) : each),
          data,
        ),
      answer,
    );
  const changes = (write: Sent, path: string) => write.changes.some((change) => change.path === path);

  /**
   * What a read shows when the server answers it: the answer, with the writes sent and not settled
   * laid over it. The answer itself is kept, for when one of them fails.
   */
  const shownOf = (hash: string, path: string, answer: unknown) => {
    if (!sent.some((write) => changes(write, path))) {
      confirmed.delete(hash);
      return answer;
    }
    confirmed.set(hash, answer);
    return laidOver(path, answer);
  };

  const peek: Peek = (path, args) => {
    const data = client.getQueryData([path, entity.id, ...args]);
    return data === undefined ? undefined : { data };
  };
  const latest = new Map<string, number>();
  /** Works the components' answers out again from the cache, for those that read one of these. */
  const rederive = (targets: Set<string>) => {
    for (const query of client.getQueryCache().getAll()) {
      // Only what is on screen: one off screen is read anew when it shows again.
      if (query.queryKey[0] !== 'component' || query.state.data === undefined || query.getObserversCount() === 0)
        continue;
      const read = dependencies.get(query.queryHash)?.services;
      const derive = derivers.get(query.queryHash);
      if (!read || !derive || ![...read].some((path) => targets.has(path))) continue;
      const turn = (latest.get(query.queryHash) ?? 0) + 1;
      latest.set(query.queryHash, turn);
      void hold(
        derive(peek).then(
          (data) => {
            // Only the last of several, for one that was worked out again meanwhile.
            if (latest.get(query.queryHash) !== turn) return;
            client.setQueryData(query.queryKey, data);
            emitData({
              action: 'derive',
              path: String(query.queryKey[1]),
              reads: [...read].filter((path) => targets.has(path)),
            });
          },
          () => undefined,
        ),
      );
    }
  };
  /** Shows the reads at these paths as the server's last answers, with the writes sent laid over them, and the components that read them. */
  const reshow = (targets: Set<string>) => {
    for (const query of client.getQueryCache().getAll()) {
      const [path] = query.queryKey;
      if (typeof path !== 'string' || !targets.has(path) || query.state.data === undefined) continue;
      const base = confirmed.has(query.queryHash) ? confirmed.get(query.queryHash) : query.state.data;
      client.setQueryData(query.queryKey, shownOf(query.queryHash, path, base));
    }
    rederive(targets);
  };

  /**
   * Makes the reads at these paths stale, and every component that read one. `by` is the write's
   * path; `from` says when it was not a write here: another tab's, or the read's own source.
   */
  const invalidatePaths = (targets: Set<string>, by: string, from?: 'source' | 'tab') => {
    if (!targets.size) return Promise.resolve();
    emitData({
      action: 'stale',
      path: by,
      reads: [...targets],
      ...(from ? { outcome: from === 'tab' ? ('received' as const) : ('pushed' as const) } : {}),
    });
    const stale = (query: Query) => {
      const [first] = query.queryKey;
      if (typeof first === 'string' && targets.has(first)) return true;
      const read = dependencies.get(query.queryHash)?.services;
      return read ? [...read].some((path) => targets.has(path)) : false;
    };
    // The client can outlive the pages, so a component off screen keeps its answer in the
    // cache, and a revisit shows it at once. One the write made stale is dropped instead, so a
    // revisit reads it anew rather than showing the answer from before the write; reading every
    // such answer again now would cost a request for each filter and page visited.
    client.removeQueries({ predicate: (query) => query.queryKey[0] === 'component' && stale(query), type: 'inactive' });
    return client.invalidateQueries({ predicate: stale });
  };

  return {
    /** Runs a service operation through the data layer. */
    call(path: string, operation: Operation, args: unknown[]): Promise<unknown> {
      const rule = rules.get(path);
      if (rule?.reads) {
        const queryKey = [path, entity.id, ...args];
        return client.fetchQuery({
          meta: { service: path },
          // The answer with the writes sent laid over it, so a read that lands while a write is
          // on its way does not undo what the write shows.
          queryFn: async () => {
            const started = performance.now();
            const answer = await operation(...args);
            emitData({ action: 'read', ms: Math.round(performance.now() - started), path });
            return shownOf(hashKey(queryKey), path, answer);
          },
          queryKey,
          ...(rule.freshFor ? { staleTime: rule.freshFor } : {}),
        });
      }
      // The interaction whose handler sent it, if one did: its handler is running now.
      const cause = activeInteraction()?.id;
      const started = performance.now();
      emitData({ action: 'write', outcome: 'sent', path, ...(cause === undefined ? {} : { cause }) });
      // An optimistic write shows its changes now, over every answer of the reads it changes.
      const write: null | Sent = rule?.optimistic?.length
        ? {
            args,
            changes: rule.optimistic.flatMap(({ change, read }) =>
              pathOf(read) ? [{ change: change as Sent['changes'][number]['change'], path: pathOf(read)! }] : [],
            ),
          }
        : null;
      const changed = new Set(write?.changes.map((change) => change.path));
      if (write) {
        sent.push(write);
        reshow(changed);
        emitData({ action: 'optimistic', path, reads: [...changed] });
      }
      const settle = () => {
        if (write) sent.splice(sent.indexOf(write), 1);
      };
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
                  const [read] = query.queryKey;
                  if (typeof read === 'string' && changed.has(read) && confirmed.has(query.queryHash))
                    confirmed.set(query.queryHash, laidOver(read, confirmed.get(query.queryHash), [write]));
                }
                settle();
              }
              emitData({ action: 'write', ms: Math.round(performance.now() - started), outcome: 'done', path });
              const stale = new Set([...paths(rule?.invalidates ?? []), ...changed]);
              if (tracking.channel && stale.size) {
                tracking.channel.postMessage({ by: path, invalidate: [...stale] });
                emitData({ action: 'tab', outcome: 'sent', path, reads: [...stale] });
              }
              if (stale.size) await invalidatePaths(stale, path);
              return result;
            },
            (error: unknown) => {
              emitData({
                action: 'write',
                ms: Math.round(performance.now() - started),
                outcome: isAbortError(error) ? 'cancelled' : 'failed',
                path,
              });
              // A rebase: the server's answers again, with the writes still on their way over them.
              if (write) {
                settle();
                reshow(changed);
                emitData({ action: 'rollback', path, reads: [...changed] });
              }
              throw report(error, { layer: 'service', path });
            },
          ),
      );
    },
    client,
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
      run: (
        record: { peek?: Peek; route: (key: string, value: unknown) => void; service: (path: string) => void },
        signal: AbortSignal,
      ) => Promise<unknown>,
      // What else the read depends on, besides the route: the locale or the user it reads.
      sources?: Record<string, unknown>,
    ) {
      const learned = routeKeys.get(path);
      const keyOf = (keys: Iterable<string>) => [
        'component',
        path,
        entity.id,
        Object.fromEntries([...keys].map((key) => [key, route[key]])),
        ...(sources ? [sources] : []),
      ];
      const queryKey = learned ? keyOf(learned) : ['component', path, entity.id, null, ...(sources ? [sources] : [])];
      return {
        meta: { component: path },
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          const read = { route: new Map<string, unknown>(), services: new Set<string>() };
          dependencies.set(hashKey(queryKey), read);
          // An optimistic write works this answer out again from the cache, with what it changed.
          const derive = (peek: Peek) =>
            run({ peek, route: () => undefined, service: () => undefined }, new AbortController().signal);
          derivers.set(hashKey(queryKey), derive);
          const started = performance.now();
          const data = await run(
            { route: (key, value) => read.route.set(key, value), service: (service) => read.services.add(service) },
            signal,
          );
          emitData({ action: 'read', ms: Math.round(performance.now() - started), path, reads: [...read.services] });
          // The first run teaches which route parameters matter; its answer is kept under that
          // key too, so the next render finds it there.
          if (!learned) {
            routeKeys.set(path, new Set(read.route.keys()));
            const known = keyOf(read.route.keys());
            dependencies.set(hashKey(known), read);
            derivers.set(hashKey(known), derive);
            client.setQueryData(known, data);
          }
          return data;
        },
        queryKey,
        staleTime: Infinity,
      };
    },
    /** The route parameters the default export at `path` read on its first run; nothing before it ran. */
    fieldsOf(path: string): ReadonlySet<string> | undefined {
      return routeKeys.get(path);
    },
    /** Records what a service folder's `meta.ts` says, keyed by operation path. */
    rule(path: string, rule: ServiceRule) {
      rules.set(path, rule);
      // A read that follows its source is stale when the source says so: here, and in each tab
      // that hears its source too.
      rule.follows?.(() => void hold(invalidatePaths(new Set([path]), path, 'source')));
    },
    /**
     * Opens the channel to the app's other tabs: a write that succeeds here makes the same reads
     * stale there, and theirs here. Returns what closes it.
     */
    share(name: string) {
      if (typeof BroadcastChannel === 'undefined') return () => undefined;
      const channel = new BroadcastChannel(name);
      tracking.channel = channel;
      channel.onmessage = (event: MessageEvent<{ by?: unknown; invalidate?: unknown }>) => {
        const stale = event.data?.invalidate;
        if (!Array.isArray(stale)) return;
        const reads = stale.filter((path): path is string => typeof path === 'string');
        const by = typeof event.data.by === 'string' ? event.data.by : 'another tab';
        emitData({ action: 'tab', outcome: 'received', path: by, reads });
        void hold(invalidatePaths(new Set(reads), by, 'tab'));
        for (const resolve of waiting) resolve();
        waiting.clear();
      };
      return () => {
        channel.close();
        if (tracking.channel === channel) tracking.channel = null;
      };
    },
  };
}

/**
 * The services, seen through a proxy that records each operation called. The proxy stands in
 * front of a blank object or function, not the tree itself: the tree's properties are read-only,
 * and a proxy of the tree would have to return them unwrapped.
 */
export function recording<T>(tree: T, record: (path: string) => void, peek?: Peek): T {
  // One proxy per node, so an operation read twice is the same function both times.
  const proxies = new WeakMap<object, unknown>();
  const wrap = (node: unknown): unknown => {
    if (!node || (typeof node !== 'object' && typeof node !== 'function')) return node;
    if (proxies.has(node)) return proxies.get(node);
    // An arrow function has no `prototype`, so the proxy may report the tree's keys alone.
    const blank = typeof node === 'function' ? () => undefined : {};
    const proxy = new Proxy(blank, {
      apply: (_, self, args) => {
        const path = pathOf(node);
        if (path) record(path);
        // Worked out again from the cache: a read it holds answers without asking.
        const cached = path && peek ? peek(path, args) : undefined;
        if (cached) return Promise.resolve(cached.data);
        return Reflect.apply(node as Operation, self, args);
      },
      get: (_, key) => wrap(Reflect.get(node as object, key)),
      getOwnPropertyDescriptor: (_, key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(node as object, key);
        return descriptor && { ...descriptor, configurable: true };
      },
      has: (_, key) => Reflect.has(node as object, key),
      ownKeys: () =>
        Reflect.ownKeys(node as object).filter(
          (key) => key !== 'prototype' && key !== 'length' && key !== 'name' && key !== 'arguments' && key !== 'caller',
        ),
    });
    proxies.set(node, proxy);
    return proxy;
  };
  return wrap(tree) as T;
}

/** The route, seen through a proxy that records each parameter read, with its value. */
export function recordingRoute<T extends object>(route: T, record: (key: string, value: unknown) => void): T {
  return new Proxy(route, {
    get: (target, key) => {
      const value = Reflect.get(target, key);
      if (typeof key === 'string') record(key, value);
      return value;
    },
  });
}
