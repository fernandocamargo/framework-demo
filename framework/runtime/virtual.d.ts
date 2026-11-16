// The modules the framework's plugin writes (framework/plugin/index.mjs).

declare module 'virtual:framework/clients' {
  export const env: import('./index').Env;
  const clients: import('./types').Injection['clients'];
  export default clients;
}

declare module 'virtual:framework/services' {
  const services: Array<{
    /** `meta.ts` beside the service: which operations read, and what writes make stale. */
    meta?: { default?: (injection: unknown) => unknown };
    module: Record<string, unknown>;
    /** The service's folders under `services/`, such as `['a', 'b', 'c', 'd', 'e']`. */
    segments: string[];
  }>;
  export default services;
}

declare module 'virtual:framework/charts' {
  const charts: Array<{
    /** The component, as importing its folder gives it. */
    component: () => Promise<{ default: import('react').ComponentType<Record<string, unknown>> }>;
    /** The component folder's path, such as `components/product/editor`. */
    path: string;
    /** Its `state.ts`. */
    state: () => Promise<Record<string, unknown>>;
  }>;
  export default charts;
}

declare module 'virtual:framework/address' {
  export const codec: import('./address').AddressCodec;
  export const useRoute: typeof import('./routing').useRoute;
  export const useNavigation: typeof import('./routing').useNavigation;
  export default codec;
}
