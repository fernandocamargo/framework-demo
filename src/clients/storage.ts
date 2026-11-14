// What a client keeps between calls. The browser's `sessionStorage` and `localStorage` fit it;
// `memoryStorage()` is the same thing for tests and for the memory world.
export type KeyValue = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> & {
  /** Calls `listener` when another tab changes `key`, once the change can be read here; returns what stops it. */
  watch?(key: string, listener: () => void): () => void;
};

/**
 * The browser's storage, shared by the tabs, saying when another tab changes a key. The `storage`
 * event fires once the change can be read in this tab. A message on a channel can arrive before
 * that (WebKit makes another page's writes visible in its own time), so what is read from here
 * follows the event, not the message.
 */
export function shared(storage: Storage = window.localStorage): KeyValue {
  return {
    getItem: (key) => storage.getItem(key),
    removeItem: (key) => storage.removeItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    watch(key, listener) {
      const changed = (event: StorageEvent) => {
        if (event.storageArea === storage && (event.key === key || event.key === null)) listener();
      };
      window.addEventListener('storage', changed);
      return () => window.removeEventListener('storage', changed);
    },
  };
}

export function memoryStorage(): KeyValue {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

/** One storage under a prefix: two worlds in one browser keep apart what they keep. */
export function prefixed(storage: KeyValue, prefix: string): KeyValue {
  return {
    getItem: (key) => storage.getItem(prefix + key),
    removeItem: (key) => storage.removeItem(prefix + key),
    setItem: (key, value) => storage.setItem(prefix + key, value),
    ...(storage.watch && { watch: (key: string, listener: () => void) => storage.watch!(prefix + key, listener) }),
  };
}

/** Waits, unless the signal aborts first: then it rejects with the signal's reason. */
export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
