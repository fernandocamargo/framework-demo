/**
 * Records how a promise settles on the promise itself, the way React's `use` reads it.
 * React suspends on a promise it has not seen settle, even one that already has; once the
 * promise says it is fulfilled, a render reads its value at once. So a view or a skin that
 * started loading before its component first renders (a preload) costs that render nothing.
 */
type Tracked<T> = Promise<T> & { reason?: unknown; status?: 'fulfilled' | 'pending' | 'rejected'; value?: T };

export function tracked<T>(promise: Promise<T>): Promise<T> {
  const thenable = promise as Tracked<T>;
  thenable.status = 'pending';
  promise.then(
    (value) => {
      thenable.status = 'fulfilled';
      thenable.value = value;
    },
    (reason: unknown) => {
      thenable.status = 'rejected';
      thenable.reason = reason;
    },
  );
  return promise;
}
