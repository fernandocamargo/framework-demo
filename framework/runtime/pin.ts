/**
 * A component held in one state of its chart, for the states gallery (gallery.ts): its chart is
 * created in that state, with the example's context over the chart's own, and never started, so
 * nothing runs and nothing moves.
 */
import { createContext, createElement, useMemo, type ReactNode } from 'react'

/** What a state needs on screen beyond what its chart starts with: a `state.ts`'s `examples[state]`. */
export type Example = {
  /** Over the chart's own context. */
  context?: Record<string, unknown>
  /** Over the form's empty values. */
  values?: Record<string, unknown>
  /** What a parent passes. */
  props?: Record<string, unknown>
  /** The route's fields, over the app's. */
  route?: Record<string, unknown>
}

export type Pin = { path: string; state: string; example: Example | undefined }

export const PinContext = createContext<Pin | null>(null)
PinContext.displayName = 'Pin'

/** Holds the component at `path`, rendered inside, in `state` (a dotted path for a nested one). */
export function Pinned({ path, state, example, children }: { path: string; state: string; example?: Example; children?: ReactNode }) {
  const pin = useMemo(() => ({ path, state, example }), [path, state, example])
  return createElement(PinContext, { value: pin }, children)
}
