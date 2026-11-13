/**
 * The state layer: a component's `state.ts` holds its flow as a
 * statechart, and the framework turns it into an XState machine.
 *
 * - `export default ({ services }) => ({ …states })`: the states, in order; the first key is
 *   where the component starts, at every level.
 * - Operations are referenced, not named by strings: `invoke: { src:
 *   services.products.get, input, onDone, onError }` runs the service.
 * - Checks and changes are the file's own exported functions, referenced where they apply
 *   (`guard: creatingNew`, `entry: goToList`). They receive XState's `context`, `event` and
 *   `self`, plus the injected sources: `route`, `flags`, `form`, `navigation`, `entity`,
 *   `services`. An action that returns an object updates the context with it.
 * - `export const context` returns what the flow itself remembers; `export const description`
 *   describes the component.
 *
 * The render receives `state`: one boolean per state (`state.editing`), the context, and `send`.
 */
import { enqueueActions, fromPromise, setup, type AnyStateMachine, type SnapshotFrom } from 'xstate'
import { useActorRef, useSelector } from '@xstate/react'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { report } from './pipeline'

type Sources = Record<string, unknown>
type Config = Record<string, unknown>
type Fn = (...args: unknown[]) => unknown

export type StateModule = Record<string, unknown> & { default?: unknown; context?: unknown; description?: unknown }

const isBuiltIn = (action: unknown) => {
  const type: unknown = typeof action === 'function' ? (action as unknown as { type?: unknown }).type : undefined
  return typeof type === 'string' && type.startsWith('xstate.')
}
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype

/** Builds the machine from a `state.ts`, naming every referenced function for XState. */
export function buildMachine(path: string, module: StateModule, injection: Sources, sources: { current: Sources }) {
  const actors: Record<string, unknown> = {}
  const guards: Record<string, Fn> = {}
  const actions: Record<string, unknown> = {}
  const names = new Map<unknown, string>()
  const flags: { key: string; path: string }[] = []
  let count = 0
  const withSources = (args: Record<string, unknown>) => ({ ...sources.current, ...args })

  const nameOf = (fn: unknown, kind: 'guard' | 'action' | 'actor') => {
    const known = names.get(fn)
    if (known) return known
    const name = `${kind}${count++}${(fn as { name?: string }).name ? `:${(fn as { name: string }).name}` : ''}`
    names.set(fn, name)
    if (kind === 'guard') guards[name] = (args: unknown) => (fn as Fn)(withSources(args as Record<string, unknown>))
    if (kind === 'actor') actors[name] = fromPromise(async ({ input }) => (fn as Fn)(input))
    if (kind === 'action') {
      actions[name] = enqueueActions(({ enqueue, ...args }) => {
        const patch = (fn as Fn)(withSources(args as Record<string, unknown>))
        if (isPlainObject(patch)) enqueue.assign(patch)
      })
    }
    return name
  }
  const action = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(action)
    if (typeof value === 'function' && !isBuiltIn(value)) return nameOf(value, 'action')
    return value
  }
  const transition = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(transition)
    if (!isPlainObject(value)) return value
    const out: Config = { ...value }
    if (typeof out['guard'] === 'function') out['guard'] = nameOf(out['guard'], 'guard')
    if (out['actions'] !== undefined) out['actions'] = action(out['actions'])
    return out
  }
  const invoke = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(invoke)
    if (!isPlainObject(value)) return value
    const out: Config = { ...value }
    if (typeof out['src'] === 'function') out['src'] = nameOf(out['src'], 'actor')
    if (typeof out['input'] === 'function') {
      const input = out['input'] as Fn
      out['input'] = (args: Record<string, unknown>) => input(withSources(args))
    }
    if (out['onDone'] !== undefined) out['onDone'] = transition(out['onDone'])
    if (out['onError'] !== undefined) out['onError'] = transition(out['onError'])
    return out
  }
  const node = (config: Config, at: string[]): Config => {
    const out: Config = { ...config }
    for (const key of ['entry', 'exit']) if (out[key] !== undefined) out[key] = action(out[key])
    if (out['always'] !== undefined) out['always'] = transition(out['always'])
    if (out['invoke'] !== undefined) out['invoke'] = invoke(out['invoke'])
    if (isPlainObject(out['after'])) out['after'] = Object.fromEntries(Object.entries(out['after']).map(([delay, value]) => [delay, transition(value)]))
    if (isPlainObject(out['on'])) out['on'] = Object.fromEntries(Object.entries(out['on']).map(([event, value]) => [event, transition(value)]))
    if (isPlainObject(out['states'])) {
      out['states'] = children(out['states'], at)
      if (out['type'] !== 'parallel' && out['initial'] === undefined) out['initial'] = Object.keys(out['states'] as Config)[0]
    }
    return out
  }
  const children = (states: Config, at: string[]) =>
    Object.fromEntries(
      Object.entries(states).map(([key, config]) => {
        flags.push({ key, path: [...at, key].join('.') })
        return [key, node(config as Config, [...at, key])]
      }),
    )

  const states = (typeof module.default === 'function' ? (module.default as Fn)(injection) : module.default) as Config
  const context = module.context
  const config = node(
    {
      id: path,
      ...(typeof module.description === 'string' ? { description: module.description } : {}),
      context: typeof context === 'function' ? (args: Record<string, unknown>) => (context as Fn)(withSources(args)) : {},
      states,
    },
    [],
  )
  // A key that names two states is shown by its whole path.
  const seen = new Map<string, number>()
  for (const { key } of flags) seen.set(key, (seen.get(key) ?? 0) + 1)
  const flagNames = flags.map(({ key, path: at }) => ({ name: (seen.get(key) ?? 0) > 1 ? at : key, path: at }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const machine = setup({ actors: actors as any, guards: guards as any, actions: actions as any }).createMachine(config as any)
  return { machine: machine as AnyStateMachine, flags: flagNames }
}

/** The machine of a component instance, with live sources, as the render sees it. */
export function useStateLayer(path: string, module: StateModule, injection: Sources, sources: Sources, rendering?: unknown) {
  // The sources read the committed route. A chart is created in its component's first render,
  // and reads the route at once: for its context, and for the input of the service its first
  // state runs. A component mounted by a change of route is rendered before that route is
  // committed, so until its first commit the chart reads the route being rendered.
  const committed = useRef(false)
  const live = useRef(sources)
  live.current = committed.current || rendering === undefined ? sources : { ...sources, route: rendering }
  useLayoutEffect(() => {
    committed.current = true
    live.current = sources
  })
  const { machine, flags } = useMemo(() => buildMachine(path, module, injection, live), [path, module, injection])
  const actor = useActorRef(machine)
  const snapshot = useSelector(actor, (state: SnapshotFrom<AnyStateMachine>) => state)

  useEffect(() => {
    const subscription = actor.subscribe({ error: (error) => report(error, { layer: 'state', path }) })
    return () => subscription.unsubscribe()
  }, [actor, path])

  return useMemo(
    () => ({
      ...Object.fromEntries(flags.map(({ name, path: at }) => [name, snapshot.matches(at as never)])),
      context: snapshot.context,
      send: actor.send,
    }),
    [snapshot, actor, flags],
  )
}
