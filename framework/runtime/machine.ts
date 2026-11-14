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
 * The render receives `state`: one boolean per state (`state.editing`), the context, `send`, and
 * `can`, whether the chart takes an event now (`state.can({ type: 'save' })`).
 *
 * The declaration (the default export) gets the injection and the sources a component may read:
 * `acl`, `user`, `flags`, the locale and the messages. Its shape may follow them (a read-only
 * editor has no `save`). When what it read changes, the chart is declared again, and the running
 * flow moves to the new chart at its next rest (no service running, no delay pending), keeping its
 * state and context when the new chart has that state, starting over when it has not.
 *
 * A chart whose file reads one of those sources is also told when it changes, by an event named
 * after it (`{ type: 'user' }`), once the component has rendered with the new value, so its guards
 * read it: a session chart that reads `user` follows a sign-in made in another tab.
 */
import { createActor, enqueueActions, fromPromise, setup, type AnyActorRef, type AnyStateMachine, type SnapshotFrom } from 'xstate'
import { useSelector } from '@xstate/react'
import { use, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { shareByIdentity } from './data'
import { PinContext, type Pin } from './pin'
import { report } from './pipeline'
import { sameParts, tracking } from './reads'

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
        if (!isPlainObject(patch)) return
        // The context keeps every part equal to what it held, as a read's answer does, and stays
        // the same object when the action changes nothing: a chart that reads something every
        // second and finds it as it was renders nothing.
        const context = ((args as { context?: unknown }).context ?? {}) as Record<string, unknown>
        const kept: Record<string, unknown> = {}
        let changed = false
        for (const [key, value] of Object.entries(patch)) {
          kept[key] = Object.hasOwn(context, key) ? shareByIdentity(context[key], value) : value
          if (!Object.hasOwn(context, key) || kept[key] !== context[key]) changed = true
        }
        if (changed) enqueue.assign(kept)
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

/** A chart, declared from the injection and what its declaration read of the sources. */
type Declared = { machine: AnyStateMachine; flags: { name: string; path: string }[]; module: StateModule; injection: Sources; sources: Sources; read: Map<string, Set<string>> }

/** Declares the chart, recording which sources its declaration read, and which of their parts. */
function declare(path: string, module: StateModule, injection: Sources, sources: Sources, live: { current: Sources }): Declared {
  const read = new Map<string, Set<string>>()
  const given = new Proxy(injection, {
    get(target, key, receiver) {
      if (typeof key !== 'string' || !Object.hasOwn(sources, key)) return Reflect.get(target, key, receiver)
      let keys = read.get(key)
      if (!keys) read.set(key, (keys = new Set()))
      return tracking(sources[key], keys)
    },
    has: (target, key) => Reflect.has(target, key) || (typeof key === 'string' && Object.hasOwn(sources, key)),
  })
  return { ...buildMachine(path, module, given, live), module, injection, sources, read }
}

/** Whether the declaration would see something else now: another module or injection, or another value in what it read. */
function stale(declared: Declared, module: StateModule, injection: Sources, sources: Sources) {
  if (declared.module !== module || declared.injection !== injection) return true
  for (const [source, keys] of declared.read) {
    const before = declared.sources[source]
    const after = sources[source]
    // An object read for none of its parts depends on nothing in it; a value, on itself.
    if (keys.size === 0 ? typeof before !== 'object' && !Object.is(before, after) : !sameParts(before, after, keys)) return true
  }
  return false
}

/** No service running and no delay pending: the flow may move to another chart. */
const atRest = (snapshot: SnapshotFrom<AnyStateMachine>) => {
  const nodes = (snapshot as unknown as { _nodes?: { invoke?: unknown[]; after?: unknown[] }[] })._nodes ?? []
  return Object.keys(snapshot.children ?? {}).length === 0 && !nodes.some((node) => (node.invoke?.length ?? 0) > 0 || (node.after?.length ?? 0) > 0)
}

/** The running flow's state and context, in another chart; nothing when that chart has no such state. */
function carried(machine: AnyStateMachine, snapshot: SnapshotFrom<AnyStateMachine>) {
  try {
    return { snapshot: machine.resolveState({ value: snapshot.value, context: snapshot.context }) }
  } catch {
    return undefined
  }
}

const sameValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (!isPlainObject(a) || !isPlainObject(b)) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]))
}

/**
 * Whether a render would get the same `state` from both: the same states, context and status. A
 * chart also moves without any of that changing (a state entered again, a service started or
 * done), and that renders nothing. Coming to rest counts as a change: a chart declared again
 * waits for it (useChart).
 */
const sameShown = (a: SnapshotFrom<AnyStateMachine>, b: SnapshotFrom<AnyStateMachine>) =>
  a === b || (a.context === b.context && a.status === b.status && a.error === b.error && sameValue(a.value, b.value) && atRest(a) === atRest(b))

const forEachActor = (actor: AnyActorRef, callback: (actor: AnyActorRef) => void) => {
  callback(actor)
  for (const child of Object.values((actor.getSnapshot() as { children?: Record<string, AnyActorRef> }).children ?? {})) forEachActor(child, callback)
}

/**
 * Stops an actor so that React may start it again: Strict Effects stop and start every effect
 * once. As @xstate/react does, each actor keeps its snapshot and may be started again.
 */
function stopRestartably(actor: AnyActorRef) {
  type Internal = AnyActorRef & { observers: Set<unknown>; _processingStatus: number; _snapshot: unknown; system: { getSnapshot?: () => unknown; _snapshot?: unknown } }
  const kept: [Internal, unknown][] = []
  forEachActor(actor, (each) => {
    kept.push([each as Internal, each.getSnapshot()])
    ;(each as Internal).observers = new Set()
  })
  const system = (actor as Internal).system
  const systemSnapshot = system.getSnapshot?.()
  actor.stop()
  system._snapshot = systemSnapshot
  for (const [each, snapshot] of kept) {
    each._processingStatus = 0
    each._snapshot = snapshot
  }
}

/** A dotted state path as XState's state value: `form.invalid` is `{ form: 'invalid' }`. */
const valueOf = (path: string): unknown => path.split('.').reduceRight<unknown>((inner, key) => (inner === undefined ? key : { [key]: inner }), undefined)

/** The chart held in one state, with the example's context over its own: never started, so nothing moves. */
function pinnedActor(machine: AnyStateMachine, pin: Pin) {
  const start = createActor(machine).getSnapshot() as SnapshotFrom<AnyStateMachine>
  const snapshot = machine.resolveState({ value: valueOf(pin.state) as never, context: { ...start.context, ...pin.example?.context } })
  return createActor(machine, { snapshot }) as AnyActorRef
}

/** The running chart: the declared one, once the flow is at rest; the last one until then. A pinned one is never started. */
function useChart(declared: Declared, pin: Pin | null) {
  // Created in the render itself, not in useState's initializer: creating it runs the chart's first
  // reads, and the route being rendered is read from contexts, which a hook's callback may not read.
  const first = useRef<{ declared: Declared; actor: AnyActorRef } | null>(null)
  first.current ??= { declared, actor: pin ? pinnedActor(declared.machine, pin) : (createActor(declared.machine) as AnyActorRef) }
  const [current, setCurrent] = useState(first.current)
  let running = current
  if (!pin && declared !== current.declared && atRest(current.actor.getSnapshot())) {
    running = { declared, actor: createActor(declared.machine, carried(declared.machine, current.actor.getSnapshot())) as AnyActorRef }
    setCurrent(running)
  }
  const { actor } = running
  useEffect(() => {
    if (pin) return
    actor.start()
    return () => stopRestartably(actor)
  }, [actor, pin])
  return running
}

/**
 * The machine of a component instance, with live sources, as the render sees it. `declared`
 * holds the sources the declaration may read; `sources`, what guards and actions read when
 * they run.
 */
export function useStateLayer(path: string, module: StateModule, injection: Sources, declared: Sources, sources: Sources, rendering?: () => unknown, told: Sources = {}) {
  // The sources read the committed route. A chart is created in its component's first render,
  // and reads the route at once: for its context, and for the input of the service its first
  // state runs. A component mounted by a change of route is rendered before that route is
  // committed, so until its first commit the chart reads the route being rendered. Only until
  // then: `rendering` reads the route's contexts, and a component follows the fields its last
  // render read. It reads them field by field, so the first change of another field after the
  // commit does not render it again either.
  const committed = useRef(false)
  const live = useRef(sources)
  live.current = committed.current || rendering === undefined ? sources : { ...sources, route: rendering() }
  useLayoutEffect(() => {
    committed.current = true
    live.current = sources
  })
  // In the states gallery, the component this pin names is held in one state.
  const pinned = use(PinContext)
  const pin = pinned?.path === path ? pinned : null
  const chart = useRef<Declared | null>(null)
  if (!chart.current || stale(chart.current, module, injection, declared)) chart.current = declare(path, module, injection, declared, live)
  const running = useChart(chart.current, pin)
  const { actor } = running
  const { flags } = running.declared
  // The last snapshot that shows something else than the one before it (sameShown).
  const snapshot = useSelector(actor, (state: SnapshotFrom<AnyStateMachine>) => state, sameShown)

  useEffect(() => {
    const subscription = actor.subscribe({ error: (error) => report(error, { layer: 'state', path }) })
    return () => subscription.unsubscribe()
  }, [actor, path])

  // The sources the chart's file reads: when one changes, the chart is told, after the commit.
  const before = useRef(told)
  useEffect(() => {
    const previous = before.current
    before.current = told
    if (pin) return
    for (const source of Object.keys(told)) if (!Object.is(previous[source], told[source])) actor.send({ type: source })
  })

  return useMemo(
    () => ({
      ...Object.fromEntries(flags.map(({ name, path: at }) => [name, snapshot.matches(at as never)])),
      context: snapshot.context,
      send: actor.send,
      // Whether the chart takes an event in the state it is in, its guards included.
      can: (event: { type: string }) => snapshot.can(event as never),
    }),
    [snapshot, actor, flags],
  )
}
