/**
 * The async layer: a component's `async.ts`.
 *
 * - Each named export reaches the render under `async`, as a function that runs it and carries
 *   its state: `async.fetchSave()`, `fetchSave.pending`, `fetchSave.error`, `fetchSave.data`.
 *   The function keeps its identity while its state changes, so a handler or a control given it
 *   is the same until what it runs with changes (the module, the injection).
 * - An export receives the injection and returns a promise, or
 *   returns a function that takes the call's arguments and returns the promise.
 * - The default export runs before the component mounts, as a query of the data layer
 *   (data.ts): it reruns when a service it read is made stale, or a route parameter it read
 *   changes. Its result reaches the render as `async.default`.
 * - Unmounting stops every state change (React ignores one made after it) and aborts the `signal` the operations got.
 * - A failure the services did not report already is reported as the async layer's.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { hold } from './activity';
import { report, toError } from './pipeline';

export type AsyncModule = Record<string, unknown> & { default?: unknown };

export type OperationState = {
  data: unknown;
  error: Error | undefined;
  pending: boolean;
};

export type Operation = ((...args: unknown[]) => Promise<unknown>) & OperationState;

const idle: OperationState = { data: undefined, error: undefined, pending: false };

/**
 * Runs an export: `(injection) => promise`, or `(injection) => (...args) => promise`. Async, so
 * an export that throws before it returns a promise fails the same way, as a rejection.
 */
export const execute = async (exported: unknown, injection: Record<string, unknown>, args: unknown[]) => {
  if (typeof exported !== 'function') throw new Error('An async export must be a function of the injection');
  const result: unknown = exported(injection);
  return typeof result === 'function' ? result(...args) : result;
};

/** The named exports, as operations with their state. */
export function useOperations(
  path: string,
  module: AsyncModule | undefined,
  injection: Record<string, unknown>,
): Record<string, Operation> {
  const names = useMemo(() => Object.keys(module ?? {}).filter((name) => name !== 'default'), [module]);
  const [states, setStates] = useState<Record<string, OperationState>>({});
  const controllers = useRef(new Set<AbortController>());
  /** Each operation's latest call. Only it sets the operation's state. */
  const latest = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const running = controllers.current;
    return () => {
      for (const controller of running) controller.abort();
      running.clear();
    };
  }, []);

  // Each operation is made once for what it runs with. Its state is put on that same function
  // at each render, so a change of state gives the record of operations a new identity (the
  // component knows it has something new to show) and leaves each operation's as it was.
  const operations = useMemo(() => {
    // After the component left, React ignores this.
    const update = (name: string, change: (state: OperationState) => OperationState) =>
      setStates((previous) => ({ ...previous, [name]: change(previous[name] ?? idle) }));
    return Object.fromEntries(
      names.map((name) => {
        const run = (...args: unknown[]) => {
          const controller = new AbortController();
          controllers.current.add(controller);
          // A call made while an earlier one runs supersedes it: the earlier one's outcome still
          // reaches its own caller, and its failure is still reported, but the state shows the
          // latest call's, whichever answers last. It is not aborted: it may be a write, which
          // an abort would not undo, only hide.
          latest.current.set(name, controller);
          const isLatest = () => latest.current.get(name) === controller;
          update(name, (state) => ({ ...state, error: undefined, pending: true }));
          const promise = hold(execute(module?.[name], { ...injection, signal: controller.signal }, args)).then(
            (data) => {
              controllers.current.delete(controller);
              if (isLatest()) update(name, () => ({ data, error: undefined, pending: false }));
              return data;
            },
            (thrown: unknown) => {
              controllers.current.delete(controller);
              const error = report(toError(thrown), { during: name, layer: 'async', path });
              if (isLatest()) update(name, (state) => ({ data: state.data, error, pending: false }));
              throw error;
            },
          );
          // The state holds the failure; a caller that does not await (an `onClick`) leaves no
          // unhandled rejection behind.
          promise.catch(() => undefined);
          return promise;
        };
        return [name, run];
      }),
    );
  }, [names, module, injection, path]);

  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries(operations).map(([name, run]) => [name, Object.assign(run, states[name] ?? idle)]),
      ) as Record<string, Operation>,
    [operations, states],
  );
}
