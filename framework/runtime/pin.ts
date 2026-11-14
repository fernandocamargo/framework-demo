/**
 * A component held in one state of its chart, for the states gallery (gallery.ts): its chart is
 * created in that state, with the example's context over the chart's own, and never started, so
 * nothing runs and nothing moves.
 */

import { createContext, createElement, type ReactNode, useMemo } from 'react';

/** What a state needs on screen beyond what its chart starts with: a `state.ts`'s `examples[state]`. */
export type Example = {
  /** Over the chart's own context. */
  context?: Record<string, unknown>;
  /** What a parent passes. */
  props?: Record<string, unknown>;
  /** The route's fields, over the app's. */
  route?: Record<string, unknown>;
  /** Over the form's empty values. */
  values?: Record<string, unknown>;
};

export type Pin = { example: Example | undefined; path: string; state: string };

export const PinContext = createContext<null | Pin>(null);
PinContext.displayName = 'Pin';

/** Holds the component at `path`, rendered inside, in `state` (a dotted path for a nested one). */
export function Pinned({
  children,
  example,
  path,
  state,
}: {
  children?: ReactNode;
  example?: Example;
  path: string;
  state: string;
}) {
  const pin = useMemo(() => ({ example, path, state }), [path, state, example]);
  return createElement(PinContext, { value: pin }, children);
}
