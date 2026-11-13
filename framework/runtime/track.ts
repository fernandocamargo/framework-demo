/**
 * The tracking wrapper. The framework's plugin rewrites every JSX
 * `on…` attribute of a component's render into `track(handler, site, key)`, so every handler
 * emits an interaction before it runs, and reports its failure with the same tags.
 *
 * One wrapper per site, handler, component instance and key, cached, so a handler that keeps
 * its identity keeps a wrapper with the same identity (memo and React Compiler still bail out).
 */
import { currentRoute, nextId, pipeline, report, type Interaction, type Scope, type Site } from './pipeline'

type Handler = (...args: unknown[]) => unknown

const cache = new WeakMap<Site, WeakMap<Handler, WeakMap<object, Map<unknown, Handler>>>>()
const NO_SCOPE = {}
let active: Interaction | null = null
let current: Scope | null = null

/** The component instance rendering right now. Set by the generated component around its render. */
export const currentScope = () => current

export function withScope<T>(scope: Scope, render: () => T): T {
  const previous = current
  current = scope
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

function wrap(handler: Handler, site: Site, scope: Scope | null, key: unknown): Handler {
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
      const result = handler.apply(this, args)
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
  let byHandler = cache.get(site)
  if (!byHandler) cache.set(site, (byHandler = new WeakMap()))
  let byScope = byHandler.get(handler as Handler)
  if (!byScope) byHandler.set(handler as Handler, (byScope = new WeakMap()))
  let byKey = byScope.get(scope ?? NO_SCOPE)
  if (!byKey) byScope.set(scope ?? NO_SCOPE, (byKey = new Map()))
  let wrapper = byKey.get(key)
  if (!wrapper) byKey.set(key, (wrapper = wrap(handler as Handler, site, scope, key)))
  return wrapper as T
}
