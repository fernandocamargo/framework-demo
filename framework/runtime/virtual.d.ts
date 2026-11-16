// The modules the framework's plugin writes (framework/plugin/index.mjs).

declare module 'virtual:framework/clients' {
  const clients: Array<{
    /** The client's folder under `clients/`, such as `socket.io`. */
    folder: string;
    /** `meta.ts` beside the client, which may rename it (`exportAs`). */
    meta?: { default?: () => { exportAs?: string } };
    module: { default: (injection: { env: unknown }) => unknown };
  }>;
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
  /** The address of a document, on the React Router router given (router.tsx). */
  export const createAddress: (
    router: import('react-router').DataRouter,
    options?: import('./address').AddressOptions,
  ) => import('./router').RouterAddress;
  export const codec: import('./address').AddressCodec;
  export default codec;
}
declare module 'virtual:framework/routes' {
  /** The app's home address, as `routes/meta.ts` names it. */
  export const home: string;
  /** React Router's route objects, one per route folder, nested as the folders are. */
  const routes: import('react-router').RouteObject[];
  export default routes;
}
