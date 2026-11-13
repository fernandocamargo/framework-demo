/**
 * The framework's runtime, imported as `framework`. Its Vite
 * plugin is `framework/plugin/index.mjs`; its TypeScript plugin, which types what it injects,
 * is `framework/typescript/`.
 *
 * An app declares the shape of what it injects by augmenting these interfaces:
 * `declare module 'framework' { interface Env { API_URL: string } }`.
 */

/** What clients receive as `env`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Env {}
/** The selected entity: a tenant, a market, a workspace. Reads are cached under its `id`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Entity {}
/** The current route's parameters (a stand-in for a routing layer). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Route {}
/** The feature flags. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Flags {}
/** How components move between routes (a stand-in for a routing layer). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Navigation {}

export { Root, type RootProps } from './root'
export { createQueryClient } from './data'
export { whenIdle } from './activity'
export { component, type Spec } from './component'
export type { I18n, Intl, Message } from './i18n-types'
export { css, selector } from './style'
export { track } from './track'
export { connect, consent, onFailure, pipeline, type Destination, type Failure, type Interaction, type Layer, type Site } from './pipeline'
export type { ServiceRule } from './data'
export type {
  AsyncInjection,
  AsyncProps,
  Client,
  ClientInjection,
  Clients,
  ErrorProps,
  FormProps,
  Language,
  Injection,
  Operation,
  OperationState,
  OperationWith,
  PlaceholderProps,
  RenderProps,
  ShapedProps,
  ServiceMeta,
  ServiceNode,
  ServiceTree,
  StateArgs,
  StateProps,
  Url,
} from './types'
