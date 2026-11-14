/**
 * The tracking wrapper. The framework's plugin rewrites every JSX
 * `on…` attribute of a component's render into `track(handler, site, key)`, so every handler
 * emits an interaction before it runs, and reports its failure with the same tags.
 *
 * Inside a component instance, a handler is an event, not a value: one wrapper per site, key and
 * place among the handlers of that site and key in the render (the third row's), for the
 * instance's life, calling the handler of the last render React committed. So an element whose
 * only new props are its handlers' closures is the same element as before, and React skips it
 * (elements.ts). A render React throws away never reaches a handler. Outside an instance (a
 * placeholder, an error file), one wrapper per site, handler and key.
 */

import { currentRoute, nextId, pipeline, report, type Interaction, type Scope, type Site } from './pipeline'

type Handler = (...args: unknown[]) => unknown

const cache = new WeakMap<Site, WeakMap<Handler, Map<unknown, Handler>>>()
let active: Interaction | null = null
let current: Scope | null = null

/** A handler's place in an instance: its wrapper, and the handlers of the last render and of the one committed. */
type Entry = { wrapper: Handler; next: Handler; committed: Handler }
/** Each instance's entries, by site, then key, in the order the render reached them. */
const entries = new WeakMap<Scope, Map<Site, Map<unknown, Entry[]>>>()
/** How many of each list (of handlers, of kept functions) the run in progress has reached. */
const reached = new WeakMap<Scope, Map<object, number>>()
/** The entries a render gave a new handler, until React commits it. */
const staged = new WeakMap<Scope, Set<Entry>>()

/** The interaction whose handler is running now, if one is. */
export const activeInteraction = () => active

/** The component instance rendering right now. Set by the generated component around its render. */
export const currentScope = () => current

export function withScope<T>(scope: Scope, render: () => T): T {
  const previous = current
  current = scope
  reached.set(scope, new Map())
  try {
    return render()
  } finally {
    current = previous
  }
}

export const chainOf = (scope: Scope | null) => {
  const chain: string[] = []
  for (let node = scope; node; node = node.parent) chain.unshift(node.path)
  return chain
}

/** After React commits a render of the instance: its handlers are the ones its wrappers call. */
export function commitHandlers(scope: Scope) {
  const entered = staged.get(scope)
  if (!entered) return
  for (const entry of entered) entry.committed = entry.next
  entered.clear()
}

function wrap(handlerOf: () => Handler, site: Site, scope: Scope | null, key: unknown): Handler {
  return function tracked(this: unknown, ...args: unknown[]) {
    const first = args[0]
    const interaction: Interaction = {
      kind: 'interaction',
      id: nextId(),
      ...(active ? { cause: active.id } : {}),
      name: `${site.path}#${site.element}.${site.prop}`,
      site,
      chain: chainOf(scope),
      ...(key === undefined ? {} : { key }),
      ...(first && typeof first === 'object' && 'nativeEvent' in first ? { type: String((first as unknown as { type: unknown }).type) } : {}),
      route: currentRoute(),
      at: performance.now(),
    }
    pipeline.emit(interaction)
    const previous = active
    active = interaction
    const tags = { layer: 'handler' as const, path: site.path, during: site.id, site, chain: interaction.chain }
    try {
      const result = handlerOf().apply(this, args)
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        ;(result as Promise<unknown>).then(undefined, (error: unknown) => report(error, tags))
      }
      return result
    } catch (error) {
      report(error, tags)
      throw error
    } finally {
      active = previous
    }
  }
}

export function track<T>(handler: T, site: Site, key?: unknown): T {
  if (typeof handler !== 'function') return handler
  const scope = current
  if (!scope) {
    let byHandler = cache.get(site)
    if (!byHandler) cache.set(site, (byHandler = new WeakMap()))
    let byKey = byHandler.get(handler as Handler)
    if (!byKey) byHandler.set(handler as Handler, (byKey = new Map()))
    let wrapper = byKey.get(key)
    if (!wrapper) byKey.set(key, (wrapper = wrap(() => handler as Handler, site, null, key)))
    return wrapper as T
  }
  let bySite = entries.get(scope)
  if (!bySite) entries.set(scope, (bySite = new Map()))
  let byKey = bySite.get(site)
  if (!byKey) bySite.set(site, (byKey = new Map()))
  let list = byKey.get(key)
  if (!list) byKey.set(key, (list = []))
  const counts = reached.get(scope) ?? new Map<object, number>()
  const at = counts.get(list) ?? 0
  counts.set(list, at + 1)
  let entry = list[at]
  if (!entry) {
    const created: Entry = { wrapper: undefined as never, next: handler as Handler, committed: handler as Handler }
    created.wrapper = wrap(() => created.committed, site, scope, key)
    list[at] = entry = created
  } else if (entry.next !== handler) {
    entry.next = handler as Handler
    let entered = staged.get(scope)
    if (!entered) staged.set(scope, (entered = new Set()))
    entered.add(entry)
  }
  return entry.wrapper as T
}

/** A function a render wrote, and the render's values it reads. */
type Kept = { fn: unknown; values: readonly unknown[] }
/** Each instance's kept functions, by site, then key, in the order the render reached them. */
const kept = new WeakMap<Scope, Map<string, Map<unknown, Kept[]>>>()

/**
 * A function written in a render's JSX that reads values of the render (a slider's output that
 * formats with the render's formatter): the plugin passes it here with those values. Inside an
 * instance it is the function of the last render that read the same values, so the element it is
 * given to is the element shown before and React skips it. The values are parameters or `const`s,
 * so the same values make a function that does the same. Outside an instance, it is as written.
 */
export function keep<T>(fn: T, values: readonly unknown[], site: string, key?: unknown): T {
  const scope = current
  if (!scope) return fn
  let bySite = kept.get(scope)
  if (!bySite) kept.set(scope, (bySite = new Map()))
  let byKey = bySite.get(site)
  if (!byKey) bySite.set(site, (byKey = new Map()))
  let list = byKey.get(key)
  if (!list) byKey.set(key, (list = []))
  const counts = reached.get(scope) ?? new Map<object, number>()
  const at = counts.get(list) ?? 0
  counts.set(list, at + 1)
  const last = list[at]
  if (last && last.values.length === values.length && last.values.every((value, index) => Object.is(value, values[index]))) return last.fn as T
  list[at] = { fn, values }
  return fn
}

