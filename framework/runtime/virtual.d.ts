// The modules the framework's plugin writes (framework/plugin/index.mjs).

declare module 'virtual:framework/clients' {
  const clients: Array<{
    /** The client's folder under `clients/`, such as `socket.io`. */
    folder: string
    module: { default: (injection: { env: unknown }) => unknown }
    /** `meta.ts` beside the client, which may rename it (`exportAs`). */
    meta?: { default?: () => { exportAs?: string } }
  }>
  export default clients
}

declare module 'virtual:framework/services' {
  const services: Array<{
    /** The service's folders under `services/`, such as `['a', 'b', 'c', 'd', 'e']`. */
    segments: string[]
    module: Record<string, unknown>
    /** `meta.ts` beside the service: which operations read, and what writes make stale. */
    meta?: { default?: (injection: unknown) => unknown }
  }>
  export default services
}

declare module 'virtual:framework/charts' {
  const charts: Array<{
    /** The component folder's path, such as `components/product/editor`. */
    path: string
    /** The component, as importing its folder gives it. */
    component: () => Promise<{ default: import('react').ComponentType<Record<string, unknown>> }>
    /** Its `state.ts`. */
    state: () => Promise<Record<string, unknown>>
  }>
  export default charts
}

