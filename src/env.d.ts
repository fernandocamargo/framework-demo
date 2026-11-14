// What this app injects, as the framework's interfaces. main.tsx gives the values to `Root`.

import 'framework';

import type { Section } from './address';
import type { SortKey } from './services/products/types';

declare module 'framework' {
  interface Env {
    /** Where DummyJSON answers. */
    apiUrl: string;
    /** GrowthBook's client key, public by design: with it, GrowthBook serves the DummyJSON world's flags. */
    flagsKey?: string;
    /** Which world the app sees: DummyJSON over the network, or the same API answered in memory. */
    world: 'dummyjson' | 'memory';
  }
  /** Reads are cached under the entity's `id`. Here it is the world, so two worlds never share an answer. */
  interface Entity {
    id: string;
  }
  /**
   * The address, parsed (src/address.ts). The catalogue's filters and every open dialog live in
   * it, so a reload, a shared link and the back button keep them. A component's read is keyed
   * by the fields it reads, and only those.
   */
  interface Route {
    /** Whether the bulk price change is open. */
    bulk: boolean;
    category: string;
    /** Whether a new product is being written. */
    create: boolean;
    /** The product being edited. */
    edit: null | number;
    order: 'asc' | 'desc';
    page: number;
    q: string;
    /** The product whose deletion is being confirmed. */
    remove: null | number;
    /** Which page of the app shows. */
    section: Section;
    /** Whether the sign-in dialog was asked for. */
    signin: boolean;
    sort: SortKey;
    /** The product whose details show. */
    view: null | number;
  }
  /** Who is signed in, from the profile the session names (`/auth/me`): DummyJSON's own user, with its role. */
  interface User {
    firstName: string;
    id: number;
    image: string;
    lastName: string;
    username: string;
  }
  /**
   * What the backend says may be done (`/auth/permissions`): a snapshot the app does not own.
   * Components get it as `acl`, with `allowed` on it, and test their rules against it.
   */
  interface Acl {
    grants: {
      customers: 'read'[];
      orders: 'read'[];
      prices: 'update'[];
      products: ('create' | 'delete' | 'read' | 'update')[];
    };
    /** The largest price change one may apply, in percent; null for no limit. */
    limits: { priceChange: null | number };
    role: 'admin' | 'guest' | 'moderator' | 'user';
  }
  /**
   * The feature flags the person signed in gets (src/clients/flags/definitions.ts): Root's `flags`
   * read. A component follows only the flags its files read.
   */
  interface Flags {
    /** Whether products may be deleted; off pauses every deletion. */
    deletions: boolean;
    /** The percentage above which a bulk price change asks a second time. */
    largeChangeAt: number;
    /** Counting stock from the catalogue's rows, with − and +. */
    stockCount: boolean;
  }
  interface Navigation {
    /** Changes these fields of the address and keeps the others. */
    go(changes: Partial<Route>): void;
  }
}
