/**
 * A stand-in for the form manager, which is a chapter of its own. A component's
 * `form.ts` says how server data becomes the form's values (`seed`) and how the values become a
 * request (`payload`). The framework keeps the values for each instance, and injects the form
 * into the render (`form.values`, `form.initial`, `form.set`) and into the state layer
 * (`form.unsaved`, `form.payload()`, `form.seed(data)`). The state layer seeds the form once.
 *
 * The values live outside React, in a store per instance. A component follows only the values its
 * files read (reads.ts), as it follows the flags: a field that holds what is typed, given
 * `form.initial` as its starting value (`defaultValue`), renders alone as a key is pressed, and
 * the component around it does not render at all. A seed renders whoever read `initial`. The
 * chart's guards and the operations read the latest values when they run, and follow none.
 */
import { useMemo, useRef, useSyncExternalStore } from 'react'
import { sameParts, tracking } from './reads'

export type FormModule = {
  seed?: (data: never) => Record<string, unknown>
  payload?: (values: never) => unknown
}

type Values = Record<string, unknown>
type State = { values: Values; initial: Values }

const same = (a: Values, b: Values) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every((key) => Object.is(a[key], b[key]))
}

/** `start`: values over the empty ones, for a component held in one state in the states gallery. */
export function useFormLayer(module: FormModule, start?: Values) {
  const kept = useRef<{ state: State; listeners: Set<() => void>; shown: { state: State } | null } | null>(null)
  if (!kept.current) {
    const values = { ...(module.seed ? module.seed(undefined as never) : {}), ...start }
    kept.current = { state: { values, initial: values }, listeners: new Set(), shown: null }
  }
  const store = kept.current
  // The values this component's files read.
  const keys = useRef(new Set<string>()).current

  // `set` and `seed` stay the same functions for the instance's life, so a part of the form that
  // is given `set` keeps its memo when another field changes.
  const actions = useMemo(() => {
    const change = (state: State) => {
      store.state = state
      for (const listener of store.listeners) listener()
    }
    return {
      subscribe: (listener: () => void) => {
        store.listeners.add(listener)
        return () => store.listeners.delete(listener)
      },
      set: (name: string, value: unknown) => change({ ...store.state, values: { ...store.state.values, [name]: value } }),
      seed: (data: unknown) => {
        const values = module.seed ? module.seed(data as never) : {}
        change({ values, initial: values })
      },
      payload: () => (module.payload ? module.payload(store.state.values as never) : store.state.values),
    }
  }, [module, store])

  // What the component shows: the same while the values it read and the seed stay as they were.
  const snapshot = () => {
    const { state } = store
    const shown = store.shown
    if (shown && shown.state.initial === state.initial && sameParts(shown.state.values, state.values, keys)) return shown
    return (store.shown = { state })
  }
  const { state } = useSyncExternalStore(actions.subscribe, snapshot, snapshot)

  // The render's form: the values it shows, recording which it reads.
  const view = useMemo(
    () => ({
      values: tracking(state.values, keys),
      initial: state.initial,
      get unsaved() {
        keys.add('*')
        return !same(state.values, state.initial)
      },
      set: actions.set,
      seed: actions.seed,
      payload: actions.payload,
    }),
    [state, keys, actions],
  )
  // The chart's and the operations' form: the latest values, when they run.
  const latest = useMemo(
    () => ({
      get values() {
        return store.state.values
      },
      get initial() {
        return store.state.initial
      },
      get unsaved() {
        return !same(store.state.values, store.state.initial)
      },
      set: actions.set,
      seed: actions.seed,
      payload: actions.payload,
    }),
    [store, actions],
  )
  return { view, latest }
}
