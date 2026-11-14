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
/** The person signed in, as `Root`'s `user` read resolves it. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface User {}
/**
 * What the backend says may be done, as `Root`'s `acl` read resolves it: a snapshot the app does
 * not own. An app declares its shape (`interface Acl { grants: …; limits: … }`).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Acl {}
/** The snapshot as a component gets it: with `allowed`, the decision of the nearest `acl.ts` at or above it. */
export type Allowed = Acl & { readonly allowed: boolean };
/** How components move between routes (a stand-in for a routing layer). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Navigation {}

export { whenIdle } from './activity';
export { component, type Spec } from './component';
export { createQueryClient, update } from './data';
export type { ServiceRule } from './data';
export { type Chart, chartAt, charts, type ChartState } from './gallery';
export type { I18n, Intl, Message } from './i18n-types';
export { type Example, Pinned } from './pin';
export {
  connect,
  consent,
  type DataEvent,
  type Destination,
  type Failure,
  type Interaction,
  type Layer,
  onData,
  onFailure,
  pipeline,
  type Site,
} from './pipeline';
export { Root, type RootProps } from './root';
export type { Keyboard } from './shortcuts';
export { css, selector } from './style';
export { keep, track } from './track';
export type {
  Access,
  AsyncInjection,
  AsyncProps,
  ChartInjection,
  Client,
  ClientInjection,
  Clients,
  ErrorProps,
  FormProps,
  Injection,
  Language,
  Operation,
  OperationState,
  OperationWith,
  PlaceholderProps,
  RenderProps,
  ServiceMeta,
  ServiceNode,
  ServiceTree,
  ShapedProps,
  Shortcut,
  Shortcuts,
  StateArgs,
  StateProps,
  Url,
} from './types';
