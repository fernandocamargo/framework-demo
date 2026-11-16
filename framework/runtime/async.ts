/**
 * The async layer: a component's `async.ts`.
 *
 * - Each named export reaches the render as a command under `async`.
 *   Its XState actor owns status, selected separately under `status` by generated hooks.
 * - An export receives the injection and returns a promise, or
 *   returns a function that takes the call's arguments and returns the promise.
 * - The default export runs before the component mounts, as a query of the data layer
 *   (data.ts): it reruns when a service it read is made stale, or a route parameter it read
 *   changes. Its result reaches the render as `async.default`.
 * - Unmounting or Activity disconnecting effects requests abort on every running signal.
 *   Native cancellation restores the preceding settled status without reporting a failure.
 * - A failure the services did not report already is reported as the async layer's.
 */

import { useActorRef } from '@xstate/react';
import { useCallback, useEffect } from 'react';

import { hold } from './activity';
import { latency } from './latency';
import { isAbortError, report } from './pipeline';

export type AsyncModule = Record<string, unknown> & { default?: unknown };

/**
 * Runs an export: `(injection) => promise`, or `(injection) => (...args) => promise`. Async, so
 * an export that throws before it returns a promise fails the same way, as a rejection.
 */
export const execute = async (exported: unknown, injection: Record<string, unknown>, args: unknown[]) => {
  if (typeof exported !== 'function') throw new Error('An async export must be a function of the injection');
  const result: unknown = exported(injection);
  return typeof result === 'function' ? result(...args) : result;
};

/** Watches each call without subscribing its owner to the operation's status. */
export function useOperation<Injection extends object, Result>(
  path: string,
  name: string,
  exported: (injection: Injection & { signal: AbortSignal }) => Result,
  injection: Injection,
) {
  const actor = useActorRef(latency);

  // The machine watches promises; stopping it cannot abort the work that created them.
  useEffect(
    () => () => {
      for (const call of actor.getSnapshot().context.running) call.abort();
    },
    [actor],
  );

  const run = useCallback(
    (...args: unknown[]) => {
      const call = new AbortController();
      actor.send({ call, type: 'WATCH' });

      const promise = (async () => {
        try {
          const data = await hold(execute(exported, { ...injection, signal: call.signal }, args));

          actor.send({ call, data, type: 'RESOLVE' });

          return data;
        } catch (thrown) {
          const error = report(thrown, { during: name, layer: 'async', path });

          actor.send(isAbortError(error) ? { call, type: 'CANCEL' } : { call, error, type: 'REJECT' });
          throw error;
        } finally {
          actor.send({ call, type: 'FINISH' });
        }
      })();

      promise.catch(() => undefined);

      return promise;
    },
    [actor, exported, injection, name, path],
  );

  return [run, actor] as const;
}
