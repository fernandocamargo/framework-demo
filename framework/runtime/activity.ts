/**
 * What the framework is still doing, so a test or the dev harness can wait for the page to settle
 * instead of sleeping or polling a selector.
 *
 * Pending is:
 * - a read or a write in a query client a `Root` uses
 * - a view or a skin still loading
 * - an operation of an `async.ts` still running
 * - a placeholder still on screen. React can hold the content back for up to 300 ms after its data
 *   arrives, so the data alone does not say the page is done
 * - a route `Root` has rendered and React has not committed yet. React renders a transition in
 *   pieces and lets frames through between them, with the old content still on screen and no
 *   placeholder.
 *
 * `whenIdle()` resolves once nothing is pending for two animation frames in a row, so the work a
 * click schedules (a transition, a read that starts while rendering) has time to show up as
 * pending, and then once the browser has no task queued, which it does not while React is still
 * rendering. It is also `window.__framework.idle()`, for tests that drive the page from outside.
 * It does not see a timer, a request made outside the framework, or an overlay still closing.
 */

import type { QueryClient } from '@tanstack/react-query';
import { type ReactNode, useLayoutEffect, useRef } from 'react';

let pending = 0;
/** The query clients the mounted `Root`s use, each counted once per `Root`. */
const clients = new Map<QueryClient, number>();
/** The components rendering a value React has not committed yet. */
const ahead = new Set<object>();

/** Counts `work` as pending until it settles; returns `work` itself. */
export function hold<T>(work: Promise<T>): Promise<T> {
  pending++;
  const release = () => {
    pending--;
  };
  work.then(release, release);
  return work;
}

/** Counts as pending until the returned function is called (at most once). */
export function holdUntilReleased(): () => void {
  pending++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pending--;
  };
}

/** A placeholder: pending from the moment it is on screen until React replaces it with the content. */
export function Pending({ children }: { children?: ReactNode }) {
  useLayoutEffect(() => holdUntilReleased(), []);
  return children ?? null;
}

/**
 * Counts as pending from a render with a new `value` until React commits it, or the render that
 * follows goes back to the committed value.
 */
export function useCommitted(value: unknown): void {
  const committed = useRef(value);
  if (Object.is(value, committed.current)) ahead.delete(committed);
  else ahead.add(committed);
  useLayoutEffect(() => {
    committed.current = value;
    ahead.delete(committed);
  }, [value]);
  useLayoutEffect(
    () => () => {
      ahead.delete(committed);
    },
    [],
  );
}

/** Counts the client's reads and writes as pending while a `Root` uses it; returns what stops it. */
export function watch(client: QueryClient): () => void {
  clients.set(client, (clients.get(client) ?? 0) + 1);
  return () => {
    const count = (clients.get(client) ?? 1) - 1;
    if (count > 0) clients.set(client, count);
    else clients.delete(client);
  };
}

/** Whether anything is pending right now. */
export function isBusy(): boolean {
  if (pending > 0 || ahead.size > 0) return true;
  for (const client of clients.keys()) if (client.isFetching() > 0 || client.isMutating() > 0) return true;
  return false;
}

const nextFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 16);
  });

/** The browser's next idle period, when no task is queued; a task where there is none (WebKit). */
const nextIdlePeriod = () =>
  new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve());
    else setTimeout(resolve, 0);
  });

/** Resolves once nothing is pending for two animation frames in a row and then in an idle period. */
export async function whenIdle(): Promise<void> {
  for (;;) {
    let quiet = 0;
    while (quiet < 2) {
      await nextFrame();
      quiet = isBusy() ? 0 : quiet + 1;
    }
    await nextIdlePeriod();
    if (!isBusy()) return;
  }
}

if (typeof window !== 'undefined') {
  const global = window as { __framework?: Record<string, unknown> };
  global.__framework = { ...global.__framework, idle: whenIdle };
}
