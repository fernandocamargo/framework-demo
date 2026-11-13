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
