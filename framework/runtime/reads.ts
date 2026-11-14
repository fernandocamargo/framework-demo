/**
 * Which parts of a value a layer reads. A component's files and its chart's declaration are
 * given views of the sources (`acl`, `user`, `flags`…) that record the keys read through them,
 * so the framework follows only those parts: a component that reads `acl.allowed` and nothing of
 * the backend's snapshot does not render again when the snapshot changes, and a chart whose
 * declaration read `acl.grants` is declared again only when `acl.grants` changes.
 */

let paused = 0;

/** Runs `work` without recording: the framework's own comparisons read every key. */
export function untracked<T>(work: () => T): T {
  paused++;
  try {
    return work();
  } finally {
    paused--;
  }
}

/** Whether reads are recorded now: not inside `untracked`. */
export const isTracking = () => paused === 0;

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

/**
 * A view of `value` that adds each top-level key read to `keys`, and `*` when the keys
 * themselves are listed (a spread, `Object.keys`): then every part counts as read.
 */
export function tracking<T>(value: T, keys: Set<string>): T {
  if (!isObject(value)) return value;
  return new Proxy(value, {
    get(target, key, receiver) {
      if (!paused && typeof key === 'string') keys.add(key);
      return Reflect.get(target, key, receiver);
    },
    ownKeys(target) {
      if (!paused) keys.add('*');
      return Reflect.ownKeys(target);
    },
  });
}

/** The parts of `value` under `keys`, or all of it for `*`: what a reader of those keys depends on. */
export function pick(value: unknown, keys: ReadonlySet<string>): unknown {
  if (!isObject(value) || keys.has('*')) return value;
  const parts: Record<string, unknown> = {};
  for (const key of keys) parts[key] = (value as Record<string, unknown>)[key];
  return parts;
}

/** Whether what was read under `keys` is the same in `before` and `after`, part by part. */
export function sameParts(before: unknown, after: unknown, keys: ReadonlySet<string>): boolean {
  if (Object.is(before, after)) return true;
  if (!isObject(before) || !isObject(after) || keys.has('*')) return false;
  for (const key of keys)
    if (!Object.is((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key])) return false;
  return true;
}
