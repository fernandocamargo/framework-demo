// What DummyJSON does not keep: it echoes a write and forgets it. This client keeps the edits,
// creations and deletions in the browser, as an overlay the product services lay over what the
// API answers (services/products/overlay.ts). So a write does change what the next read finds.
//
// Each edited product has a version. A save says which version it changed; when the stored one
// is newer, somebody else saved meanwhile (another tab, or the network lab's button), and the
// save is refused as a conflict.

import type { Product } from '@/services/products/types';

import { type KeyValue, prefixed, shared, sleep } from '../storage';

export type Overlay = {
  created: Product[];
  /** Changed fields by product id, with the version the change made. */
  edits: Record<number, { changes: Partial<Product>; version: number }>;
  removed: number[];
};

export class ConflictError extends Error {
  override name = 'ConflictError';
  constructor(readonly version: number) {
    super('Somebody else changed this product while you were editing it.');
  }
}

const KEY = 'framework-demo:overlay';
/** New products get ids no DummyJSON product has. */
export const FIRST_LOCAL_ID = 10_001;
export const isLocal = (id: number) => id >= FIRST_LOCAL_ID;

const EMPTY: Overlay = { created: [], edits: {}, removed: [] };

export function createStore({ latency = 0, storage }: { latency?: number; storage: KeyValue }) {
  const load = (): Overlay => {
    try {
      return { ...EMPTY, ...(JSON.parse(storage.getItem(KEY) ?? '{}') as Partial<Overlay>) };
    } catch {
      return EMPTY;
    }
  };
  const save = (overlay: Overlay) => storage.setItem(KEY, JSON.stringify(overlay));
  const versionOf = (overlay: Overlay, id: number) => overlay.edits[id]?.version ?? 1;
  const merge = (overlay: Overlay, id: number, changes: Partial<Product>): Overlay => ({
    ...overlay,
    edits: {
      ...overlay.edits,
      [id]: { changes: { ...overlay.edits[id]?.changes, ...changes }, version: versionOf(overlay, id) + 1 },
    },
  });

  return {
    /** Calls `listener` when another tab changes the overlay; returns what stops it. */
    changed: (listener: () => void) => storage.watch?.(KEY, listener) ?? (() => undefined),
    async create(product: Omit<Product, 'id'>): Promise<Product> {
      await sleep(latency);
      const overlay = load();
      const created = { ...product, id: Math.max(FIRST_LOCAL_ID - 1, ...overlay.created.map((item) => item.id)) + 1 };
      save({ ...overlay, created: [created, ...overlay.created] });
      return created;
    },
    /** Keeps an edit. With `expected`, refuses it when the product's version is no longer that one. */
    async edit(id: number, changes: Partial<Product>, expected?: number): Promise<number> {
      await sleep(latency);
      const overlay = load();
      const version = versionOf(overlay, id);
      if (expected !== undefined && expected !== version) throw new ConflictError(version);
      save(merge(overlay, id, changes));
      return version + 1;
    },
    async read(): Promise<Overlay> {
      await sleep(latency);
      return load();
    },
    async remove(id: number): Promise<void> {
      await sleep(latency);
      const overlay = load();
      save({
        ...overlay,
        created: overlay.created.filter((item) => item.id !== id),
        removed: isLocal(id) ? overlay.removed : [...new Set([...overlay.removed, id])],
      });
    },
    /** Forgets everything: the catalogue is DummyJSON's again. */
    async reset(): Promise<void> {
      await sleep(latency);
      storage.removeItem(KEY);
    },
  };
}

// Both worlds keep the changes in localStorage, apart, so every tab of a world sees the same catalogue.
export default ({ env }) =>
  env.world === 'memory'
    ? createStore({ storage: prefixed(shared(), 'memory:') })
    : createStore({ latency: 120, storage: shared() });
