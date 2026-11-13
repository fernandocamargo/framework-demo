/**
 * A stand-in for the form manager, which is a chapter of its own. A component's
 * `form.ts` says how server data becomes the form's values (`seed`) and how the values become a
 * request (`payload`). The framework keeps the values for each instance, and injects the form
 * into the render (`form.values`, `form.set`) and into the state layer (`form.unsaved`,
 * `form.payload()`, `form.seed(data)`). The state layer seeds the form once.
 */
import { useMemo, useState } from 'react'

export type FormModule = {
  seed?: (data: never) => Record<string, unknown>
  payload?: (values: never) => unknown
}

const same = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every((key) => Object.is(a[key], b[key]))
}

export function useFormLayer(module: FormModule) {
  const empty = () => (module.seed ? module.seed(undefined as never) : {})
  const [state, setState] = useState(() => {
    const values = empty()
    return { values, initial: values }
  })

  // `set` and `seed` stay the same functions for the instance's life, so a part of the form that
  // is given `set` keeps its memo when another field changes.
  const actions = useMemo(
    () => ({
      set: (name: string, value: unknown) => setState((previous) => ({ ...previous, values: { ...previous.values, [name]: value } })),
      seed: (data: unknown) => {
        const values = module.seed ? module.seed(data as never) : {}
        setState({ values, initial: values })
      },
    }),
    [module],
  )
  return useMemo(
    () => ({
      values: state.values,
      unsaved: !same(state.values, state.initial),
      ...actions,
      payload: () => (module.payload ? module.payload(state.values as never) : state.values),
    }),
    [state, module, actions],
  )
}
