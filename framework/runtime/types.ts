/**
 * The types of what the framework injects. Authors never write them: the TypeScript plugin
 * (framework/typescript/) annotates each injected argument with one of these,
 * filling in the app's own clients and services.
 */

import type { ReactNode } from 'react';
import type { ActorRefFrom, SnapshotFrom } from 'xstate';

import type { Update } from './data';
import type { I18n, Intl } from './i18n-types';
import type { Allowed, Entity, Env, Flags, Navigation, RouteRead, User } from './index';
import type { latency } from './latency';
import type { Keyboard } from './shortcuts';

/** The page's URL, read when an operation runs. */
export type Url = {
  params: {
    /** The page's search parameters, with `extra` set on top. */
    merge: (extra: Record<string, boolean | number | string>) => URLSearchParams;
  };
};

// The runtime handles the trees without knowing their shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tree = any;

/** What a service receives. */
export type Injection<Clients = Tree, Services = Tree> = {
  clients: Clients;
  /** The selected entity, read when the service runs. */
  entity: Entity;
  env: Env;
  services: Services;
  url: Url;
};

/** What the state and async layers read besides the services: the route, the flags and how to move. */
export type Sources = {
  flags: Flags;
  navigation: Navigation;
  route: RouteRead;
};

/**
 * The locale on screen and what follows it: react-intl's `intl`, and the folder's messages when it
 * has an `i18n.ts`. A component that destructures any of them follows the locale.
 */
export type Language<I18nModule = undefined> = ([I18nModule] extends [undefined]
  ? unknown
  : { i18n: I18n<I18nModule> }) & {
  /** react-intl's `intl` for that locale: `formatNumber`, `formatDate`, `formatList`, `formatRelativeTime`… */
  intl: Intl;
  /** The locale on screen, such as `pt-BR`. */
  locale: string;
};

/**
 * Who is signed in and what may be done, for a component's files. A component whose files read
 * `user` waits for Root's `user` read the first time, and renders again when the person changes.
 */
export type Access = {
  /**
   * The backend's snapshot (Root's `acl` read), with `allowed`: what the nearest `acl.ts` at or
   * above this component decided. A component follows only the parts of it it reads.
   */
  acl: Allowed;
  /** The person signed in, or null: Root's `user` read. */
  user: null | User;
};

/**
 * What a chart's declaration (state.ts's default export) receives: the injection, and the sources
 * its shape may follow. When a part it read changes, the chart is declared again.
 */
export type ChartInjection<Clients = Tree, Services = Tree, I18nModule = undefined> = Access &
  Injection<Clients, Services> &
  Language<I18nModule> & { flags: Flags };

/** What an export of a component's `async.ts` receives: the injection, the sources, the locale, who is signed in, and a signal that aborts on unmount. */
export type AsyncInjection<Clients = Tree, Services = Tree> = Injection<Clients, Services> &
  Language &
  Pick<Access, 'user'> &
  Sources & { signal: AbortSignal };

/** What a client's factory receives. */
export type ClientInjection = { env: Env };

type Created<F> = F extends (injection: never) => infer Created ? Created : never;

/**
 * Shows a type's members in editors' hovers, instead of the name and arguments of the helper
 * that computed it. The `infer` step is what keeps the helper's name out of the hover.
 */
type Shown<T> = T extends infer Members ? { [Name in keyof Members]: Members[Name] } : never;

type Named<Module> = { [Name in Exclude<keyof Module, 'default'>]: Created<Module[Name]> };

/**
 * A service folder as services see it: its default export's operation, callable, and its named
 * exports' operations as properties (`services.singleFile.fetchSomething`). Hovers show the
 * operations themselves.
 */
export type ServiceNode<Module> = Module extends { default: (injection: never) => infer Operation }
  ? [Exclude<keyof Module, 'default'>] extends [never]
    ? Operation
    : Operation & Shown<Named<Module>>
  : Shown<Named<Module>>;

/** A client as services see it: what its factory returns. */
export type Client<Module> = Module extends { default: (injection: never) => infer Created } ? Created : never;

/** `clients`, from `[name, module]` entries, one per client folder. Written by the TypeScript plugin. */
export type Clients<Entries extends [string, unknown]> = Shown<{
  [Name in Entries[0]]: Client<Extract<Entries, [Name, unknown]>[1]>;
}>;

type Head<Path> = Path extends `${infer First}.${string}` ? First : Path;
type Self<Entries, Key> = Entries extends [Key, infer Module] ? ServiceNode<Module> : never;
type Below<Entries, Key extends string> = Entries extends [`${Key}.${infer Path}`, infer Module]
  ? [Path, Module]
  : never;
type NodeOf<Entries, Key extends string> = [Self<Entries, Key>] extends [never]
  ? ServiceTree<Below<Entries, Key>>
  : [Below<Entries, Key>] extends [never]
    ? Self<Entries, Key>
    : Self<Entries, Key> & ServiceTree<Below<Entries, Key>>;

/**
 * `services`, from `[path, module]` entries, one per service folder (`["a.b.c.d.e", …]`).
 * Written by the TypeScript plugin. Built here, rather than written out, so that hovers show
 * the operations and not the plugin's text.
 */
export type ServiceTree<Entries extends [string, unknown]> = Shown<{ [Key in Head<Entries[0]>]: NodeOf<Entries, Key> }>;

type OperationSnapshot<Data> = Omit<SnapshotFrom<typeof latency>, 'context'> & {
  context: Omit<SnapshotFrom<typeof latency>['context'], 'data'> & { data: Data | undefined };
};

/** The owned operation's selected status. The actor is read-only in TypeScript, not a runtime membrane. */
export type OperationState<Data> = {
  readonly actor: Pick<ActorRefFrom<typeof latency>, 'subscribe'> & {
    readonly getSnapshot: () => OperationSnapshot<Data>;
  };
  /** What the last successful run resolved to. */
  readonly data: Data | undefined;
  /** The last run's failure, as an `Error` even when something else was thrown. */
  readonly error: Error | undefined;
  /** True while a run is in flight. */
  readonly pending: boolean;
};

/**
 * An async command, named after what it resolves to. `Operation<Saved>` takes no arguments.
 */
export type Operation<Data = unknown> = () => Promise<Data>;

/** An async operation that takes arguments: `OperationWith<[id: string], Saved>`. */
export type OperationWith<Args extends unknown[], Data = unknown> = (...args: Args) => Promise<Data>;

/**
 * An export takes the injection and returns a promise (the operation takes no arguments), or
 * returns a function of the call's arguments that returns one.
 */
type OperationOf<Export> =
  Created<Export> extends (...args: infer Args) => infer Result
    ? Result extends Promise<Awaited<Result>>
      ? Created<Export>
      : [] extends Args
        ? Operation<Awaited<Result>>
        : OperationWith<Args, Awaited<Result>>
    : Operation<Awaited<Created<Export>>>;

type Resolved<Export> =
  Created<Export> extends (...args: never[]) => infer Result ? Awaited<Result> : Awaited<Created<Export>>;

/** The `async` prop: each named export as an operation, and the default export's result as `default`. */
export type AsyncProps<Module> = Shown<
  (Module extends { default: infer Default } ? { default: Resolved<Default> } : unknown) & {
    [Name in Exclude<keyof Module, 'default'>]: OperationOf<Module[Name]>;
  }
>;

/** Named operation status lives beside the commands; the default export remains a query. */
export type StatusProps<Module> = {
  readonly [Name in Exclude<keyof Module, 'default'>]: OperationState<Resolved<Module[Name]>>;
};

/** What a service folder's `meta.ts` says, by export (`default` for the default export). */
export type ServiceMeta<Module> = {
  [Name in keyof Module]?: {
    /**
     * For a read whose source can change outside the app (a flag provider's push, a socket): calls
     * `stale` whenever it does, and the read is read again, with every component that read it.
     * `(stale) => flags.changed(stale)`. What it returns, if anything, stops it.
     */
    follows?: (stale: () => void) => (() => void) | void;
    /** For a read: how long, in milliseconds, an answer is served again without asking. */
    freshFor?: number;
    /** The operations this one makes stale when it succeeds, by reference. */
    invalidates?: unknown[];
    /**
     * The reads this write changes when it is sent, before the server confirms it, each with how:
     * `[update(products.get, (product, change) => …)]`. Shown at once; taken out if the write fails.
     */
    optimistic?: readonly Update<ArgsOf<Module[Name]>>[];
    /** The operation reads: its results are cached and shared. */
    reads?: boolean;
  };
};

type ArgsOf<Export> = Created<Export> extends (...args: infer Args) => unknown ? Args : never;

// ---- The form stand-in (form.ts) ------------------------------------------------------------

type FormValues<FormModule> = FormModule extends { seed: (...args: never[]) => infer Values }
  ? Values
  : Record<string, unknown>;
type FormPayload<FormModule> = FormModule extends { payload: (...args: never[]) => infer Payload } ? Payload : unknown;
type FormData<FormModule> = FormModule extends { seed: (data: infer Data, ...props: never[]) => unknown }
  ? Data
  : unknown;

/** The form, as the render and the state layer see it (a stand-in for a form manager). */
export type FormProps<FormModule> = Shown<FormShape<FormModule>>;

type FormShape<FormModule> = {
  /**
   * The values as last seeded, for a field that holds what is typed (`defaultValue={form.initial.title}`):
   * then a key renders that field alone. A field mounted again after a seed starts from it.
   */
  initial: FormValues<FormModule>;
  /** The request the values make (`form.ts`'s `payload`). */
  payload: () => FormPayload<FormModule>;
  /** Starts the form over from server data (`form.ts`'s `seed`, which also gets the component's props). */
  seed: (data: FormData<FormModule>) => void;
  /** Sets one value. */
  set: <Name extends keyof FormValues<FormModule>>(name: Name, value: FormValues<FormModule>[Name]) => void;
  /** Whether the values changed since the form was last seeded. */
  unsaved: boolean;
  /**
   * The form's values. A component follows those its files read: a field that reads its value
   * (`value={form.values.title}`) renders the component as a key is pressed.
   */
  values: FormValues<FormModule>;
};

// ---- The state layer (state.ts) ---------------------------------------------------------------

type StatesOf<Module> = Module extends { default: (injection: never) => infer States }
  ? States
  : Module extends { default: infer States }
    ? States
    : never;

type StateNames<States> = {
  [Name in keyof States & string]:
    | Name
    | (States[Name] extends { states: infer Children } ? StateNames<Children> : never);
}[keyof States & string];

type EventNames<States> = {
  [Name in keyof States & string]:
    | (States[Name] extends { on: infer On } ? keyof On & string : never)
    | (States[Name] extends { states: infer Children } ? EventNames<Children> : never);
}[keyof States & string];

type EventOf<Name, Payloads> = Name extends keyof Payloads ? Payloads[Name] & { type: Name } : { type: Name };

type ContextOf<Module> = Module extends { context: (...args: never[]) => infer Context }
  ? Context
  : Record<string, never>;

type Merged<Union> = (Union extends unknown ? (value: Union) => void : never) extends (value: infer Both) => void
  ? Both
  : never;

/**
 * What a `state.ts` function receives: XState's `context`, `event` and `self`, and the injected
 * sources. The event is any of the chart's: its `type`, the output of a finished service, and
 * the payloads the file's `Events` declares.
 */
export type StateArgs<
  Clients = Tree,
  Services = Tree,
  Module = unknown,
  Payloads = object,
  FormModule = undefined,
  I18nModule = undefined,
> = ([FormModule] extends [undefined] ? unknown : { form: FormProps<FormModule> }) &
  Access &
  Injection<Clients, Services> &
  Language<I18nModule> &
  Sources & {
    context: ContextOf<Module>;
    event: StateEvent<Payloads>;
    self: unknown;
  };

/** Any event of a chart: its type, a finished service's output or error, and the declared payloads' fields. */
type StateEvent<Payloads> = Shown<
  ([keyof Payloads] extends [never] ? unknown : Partial<Merged<Payloads[keyof Payloads]>>) & {
    error?: unknown;
    output?: Tree;
    type: string;
  }
>;

/**
 * The `state` prop: one boolean per state of the chart (`state.editing`, `state.saving`), the
 * flow's context, and `send`, which takes the chart's events.
 */
export type StateProps<Module, Payloads = object> = Shown<
  { [Name in StateNames<StatesOf<Module>>]: boolean } & {
    /** Whether the chart takes this event in the state it is in, its guards included. */
    can: (event: EventOf<EventNames<StatesOf<Module>>, Payloads>) => boolean;
    context: ContextOf<Module>;
    send: (event: EventOf<EventNames<StatesOf<Module>>, Payloads>) => void;
  }
>;

// ---- What renders, placeholders and error files receive ---------------------------------------

/** What a parent passes, when the folder's `props.ts` does not state it (`export type Props`). */
type Passed = { [prop: string]: unknown; children?: ReactNode };

/** A component folder's layers, as the TypeScript plugin passes them to `RenderProps`. */
type Layers = {
  async?: unknown;
  events?: unknown;
  form?: unknown;
  handlers?: unknown;
  i18n?: unknown;
  passed?: unknown;
  routes?: unknown;
  state?: unknown;
};

/** Each named handler export reaches the render as the function it returns. */
export type HandlerProps<Module> = Shown<{
  [Name in Exclude<keyof Module, 'default'>]: Created<Module[Name]>;
}>;

/**
 * What a render receives: the props (as `props.ts` states them with `export type Props`, when it
 * does), its `className` (the folder's path), and `async`, `state` and `form` when the folder has
 * `async.ts`, `state.ts` and `form.ts`.
 */
export type RenderProps<Folder extends Layers = Layers> = ('async' extends keyof Folder
  ? { async: AsyncProps<Folder['async']>; status: StatusProps<Folder['async']> }
  : unknown) &
  ('form' extends keyof Folder ? { form: FormProps<Folder['form']> } : unknown) &
  ('handlers' extends keyof Folder ? { handlers: HandlerProps<Folder['handlers']> } : unknown) &
  ('passed' extends keyof Folder ? Folder['passed'] : Passed) &
  ('routes' extends keyof Folder ? { routes: ReactNode } : unknown) &
  ('state' extends keyof Folder ? { state: StateProps<Folder['state'], Folder['events']> } : unknown) &
  Access &
  Language<'i18n' extends keyof Folder ? Folder['i18n'] : undefined> & { className: string } & {
    flags: Flags;
    keyboard: Keyboard;
    navigation: Navigation;
    route: RouteRead;
  };

/** What each named export of handlers.ts receives when an event calls it. */
export type HandlerArgs<Folder extends Layers = Layers, Clients = Tree, Services = Tree> = Pick<
  Injection<Clients, Services>,
  'entity' | 'services'
> &
  Pick<Sources, 'navigation'> &
  RenderProps<Folder>;

/**
 * One key of a `shortcuts.ts`: what it says, and what it does. `send` takes the chart's events, so
 * a folder with no `state.ts` has only `focus` and `run`.
 */
export type Shortcut<Events extends string = never> = {
  /** What the key does, in the locale on screen: the list of keys shows it. */
  label: string;
  /** Whether the key may be used now; true when left out. */
  when?: boolean;
} & (
  | { focus: string; run?: never; send?: never }
  | { focus?: never; run: () => unknown; send?: never }
  | { focus?: never; run?: never; send: Events | { type: Events } }
);

/** What a `shortcuts.ts` returns: keys (`mod+s`, `/`, `n`, `shift+?`) and what each does. */
export type Shortcuts<StateModule = undefined> = Record<
  string,
  Shortcut<[StateModule] extends [undefined] ? never : EventNames<StatesOf<StateModule>>>
>;

/**
 * What a render receives when its folder has a `props.ts`: what that file's default export returns,
 * and the `className`. `props.ts` receives what the render would have (`RenderProps`) and shapes
 * it, so the render only interpolates flags and markup.
 */
export type ShapedProps<Module, Handlers = undefined> = ([Handlers] extends [undefined]
  ? unknown
  : { handlers: HandlerProps<Handlers> }) &
  (Module extends { default: (...args: never[]) => infer Shaped }
    ? Shaped & { className: string }
    : { className: string });

/** What a placeholder receives: the component's props and its `className`, and the folder's messages when it has an `i18n.ts`. */
export type PlaceholderProps<I18nModule = undefined> = ([I18nModule] extends [undefined]
  ? unknown
  : Language<I18nModule>) &
  Passed & { className: string };

/** What an error fallback receives: the component's props, its `className`, the error and a way to try again. */
export type ErrorProps<I18nModule = undefined> = PlaceholderProps<I18nModule> & {
  /** What failed, as an `Error` even when something else was thrown. */
  error: Error;
  /** Renders the component again; a failed `async.ts` default export runs again. */
  resetErrorBoundary: () => void;
};
