// What a client keeps between calls. The browser's `sessionStorage` and `localStorage` fit it;
// `memoryStorage()` is the same thing for tests and for the memory world.
export type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function memoryStorage(): KeyValue {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  }
}

/** One storage under a prefix: two worlds in one browser keep apart what they keep. */
export function prefixed(storage: KeyValue, prefix: string): KeyValue {
  return {
    getItem: (key) => storage.getItem(prefix + key),
    setItem: (key, value) => storage.setItem(prefix + key, value),
    removeItem: (key) => storage.removeItem(prefix + key),
  }
}

/** Waits, unless the signal aborts first: then it rejects with the signal's reason. */
export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, ms)
    const abort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
