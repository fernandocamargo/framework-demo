/**
 * What the plugin's generated module for a component folder calls.
 *
 * The view (the render and its layers: `async.ts`, `state.ts`, `form.ts`) is always lazy.
 * Before the view first renders, it waits for its code, its skin and its `async.ts` default
 * export. A placeholder file adds a `Suspense` around it, and an error file adds an
 * `ErrorBoundary` around both. Without them, the nearest ones above catch the component.
 *
 * The render is called as a plain function, inside the component instance's scope, so
 * the handlers it passes are tracked with their placement. It receives the props, the
 * `className` (the component's path), and `async`, `state` and `form` when the folder has them.
 *
 * A component also gets, when one of its files reads it: the locale (`i18n`, `intl`, `locale`),
 * the person signed in (`user`), what it may do (`acl`), the flags, the route, and the keys on
 * screen (`keyboard`). A folder's `shortcuts.ts` declares the keys the component answers
 * (shortcuts.ts). A folder's
 * `acl.ts` says, as a boolean, whether what the component offers may be done; the component and
 * everything below it get that as `acl.allowed`, until a folder below says otherwise.
 */

import {
  type QueryObserverResult,
  useQueryErrorResetBoundary,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import {
  type ComponentType,
  createContext,
  createElement,
  memo,
  type ReactNode,
  Suspense,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

import { hold, Pending } from './activity';
import { type AsyncModule, execute, useOperations } from './async';
import { recording, recordingRoute, shareByIdentity } from './data';
import { shareElements } from './elements';
import { type FormModule, useFormLayer } from './form';
import { activeLocale, forgetMessages, intlFor, loadMessages, LocaleContext, showing, SOURCE_LOCALE } from './i18n';
import type { Allowed, Flags, Route } from './index';
import { type StateModule, useStateLayer } from './machine';
import { PinContext } from './pin';
import { report, type Scope, toError } from './pipeline';
import { during, sameParts, tracking, untracked } from './reads';
import { fieldContext, followRoute, renderingRoute, RouteContext, type RouteView, useFramework } from './root';
import { type Entry, type ShortcutSites, shortcutsOf, useKeyboard, useShortcuts } from './shortcuts';
import { activeSkin, loadSkin, replaceSkin, type SkinModule } from './style';
import { tracked } from './thenable';
import { chainOf, commitHandlers, withScope } from './track';

type Props = Record<string, unknown> & { className?: string };

type ViewModule = {
  /** `acl.ts`: whether what the component offers may be done. */
  acl?: undefined | { default?: unknown };
  async: AsyncModule | undefined;
  /** The components the render shows, from the plugin: their loads start when this view has loaded. */
  children?: readonly { preload?: () => void }[];
  form: FormModule | undefined;
  /**
   * `handlers.ts`, as the plugin wrote it into a hook: one `useCallback` per export, each given
   * what its export reads. `route` says how they read the route: some of its fields, or all of it.
   * `shape` names the hook's callbacks and their dependencies: another shape is other hooks.
   */
  handlers?:
    | undefined
    | { route?: 'fields' | 'whole'; shape: string; useHandlers: (given: Props, scope: Scope) => Props };
  /** `props.ts`: what the render would get, shaped into what it gets. */
  props: undefined | { default?: unknown };
  render: (props: Props) => ReactNode;
  /** `shortcuts.ts`: the keys the component answers while it is on screen. */
  shortcuts?: undefined | { default?: unknown };
  /** Where each key is declared in `shortcuts.ts`, from the plugin, for the interactions it runs. */
  shortcutSites?: ShortcutSites;
  state: StateModule | undefined;
};

export type Spec = {
  error?: ComponentType<Props & { error: Error; resetErrorBoundary: () => void }>;
  /** `i18n.ts`: the folder's messages, in the source language. */
  i18n?: { default?: unknown };
  /** The folder's path from the framework's root, such as `components/app`: the class name. */
  path: string;
  placeholder?: ComponentType<Props>;
  /**
   * The sources the folder's files read (`intl`, `locale`, `i18n`, `user`, `acl`, `flags`,
   * `route`, `keyboard`), from what their functions destructure: in the view's files (`props.ts`, the render),
   * in `acl.ts` (every name it destructures), in `async.ts`, in `state.ts`, and in the chart's
   * declaration alone. Only what the view reads makes the component render again when it
   * changes; what `async.ts` reads keys its default read; what the declaration reads, declares the
   * chart again.
   */
  reads?: {
    acl?: readonly string[];
    async?: readonly string[];
    chart?: readonly string[];
    state?: readonly string[];
    view?: readonly string[];
  };
  skins: Record<string, () => Promise<SkinModule>>;
  /** Each translation of the messages, `i18n/<locale>.json`, loaded on demand. */
  translations?: Record<string, () => Promise<{ default: Record<string, string> }>>;
  view: () => Promise<ViewModule>;
};

/** What the nearest `acl.ts` above decided. With none, everything is allowed. */
export const AclContext = createContext<boolean>(true);
AclContext.displayName = 'Acl';

const NO_SNAPSHOT = Object.freeze({});
const NO_FLAGS = Object.freeze({}) as Flags;

/**
 * A value as a component last rendered it. A new one stands for a change in a part the component
 * read; the same one, for none. It is not a plain object, so TanStack compares it by identity.
 */
class Seen {
  constructor(readonly value: unknown) {}
}
/** The same `Seen` while the parts under `keys` stay as they were, a new one when one changes. */
const seenOf = (last: null | Seen, value: unknown, keys: ReadonlySet<string>) =>
  last && sameParts(last.value, value, keys) ? last : new Seen(value);
/** Each snapshot with each decision on it, one object per pair, so it keeps its identity. */
const decisions = new WeakMap<object, [Allowed?, Allowed?]>();

/** The backend's snapshot with a decision on it: what a component gets as `acl`. */
function allowedOn(snapshot: unknown, allowed: boolean): Allowed {
  const base = (snapshot && typeof snapshot === 'object' ? snapshot : NO_SNAPSHOT) as object;
  let pair = decisions.get(base);
  if (!pair) decisions.set(base, (pair = []));
  const at = allowed ? 1 : 0;
  return (pair[at] ??= Object.freeze({ ...base, allowed }) as Allowed);
}

/** The keys of the snapshot a component read; `allowed` is the decision's, not the snapshot's. */
const ofSnapshot = (keys: ReadonlySet<string>) => new Set([...keys].filter((key) => key !== 'allowed'));

const ScopeContext = createContext<null | Scope>(null);
ScopeContext.displayName = 'Scope';

/** The path first, then any class the parent passes. */
const classes = (path: string, className: unknown) =>
  typeof className === 'string' && className ? `${path} ${className}` : path;

const NO_LAYER = Object.freeze({});
const NO_FORM = Object.freeze({ latest: undefined, view: undefined });

/** A render of a component, as React showed it: what it was given, what it returned, and what was decided. */
type Shown = {
  allowed: boolean;
  element: ReactNode;
  inputs: unknown[];
  /** The keys its shortcuts.ts declared, for a folder with one. */
  keys: Entry[] | undefined;
  /** The view's files it was rendered with. */
  module: unknown;
  /**
   * The operations it was given. An operation keeps its identity while its state changes, so what
   * the render got can compare equal while an operation's state is new: for a folder whose files
   * read `async`, a new record of operations, which a change of state makes, calls the render again.
   */
  operations: unknown;
  props: Props;
  rendered: ReactNode;
  scope: Scope;
  shaped: Props;
};

/** Only the values a component reads, so spreading them over the props adds nothing else. */
/**
 * What wraps a folder's error file while it shows: when the address moves on (another page, other
 * filters), the folder tries again, as "Try again" would, and its read runs for the new address.
 * It reads the whole route, but only while it is on screen: a component that did not fail follows
 * only the fields it reads.
 */
function Retrying({ children, retry }: { children?: ReactNode; retry: () => void }) {
  const route = use(RouteContext);
  const [failedAt] = useState(route);
  useLayoutEffect(() => {
    if (route !== failedAt) retry();
  }, [route, failedAt, retry]);
  return children;
}

const defined = (values: object) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Record<string, unknown>;

const sameEach = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
const sameRoute = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const keys = Object.keys(b);
  return Object.keys(a).length === keys.length && keys.every((key) => key in a && Object.is(a[key], b[key]));
};

/** The props are the same when they have the same keys with the same values, as `memo` compares them. */
const sameProps = (a: Props, b: Props) => {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]))
  );
};

type Read = NonNullable<ReturnType<typeof useFramework>['user']>;

/** For a Root without one of its reads: a read that is there from the start and holds nothing. */
const NO_READ = {
  initialData: null,
  queryFn: () => null,
  queryKey: ['framework/none'],
  staleTime: Infinity,
} as unknown as Read;

// Which hooks a component calls is fixed when its type is created, from what its folder's files
// read, and for the rest once its view has loaded, before its first render. Each choice below is
// between two hooks, made once: every render of a component then calls the same hooks in the same
// order, with no hook behind a condition, and a lint can check it.

/** Whether a dev server is serving the page: it sends a folder's files again as they are edited. */
const HOT = Boolean((import.meta as { hot?: unknown }).hot);

/** A folder's files as the dev server last sent them: who listens for the next ones, and how many came. */
type Edits = { listeners: Set<() => void>; version: number };
/** Renders the component again when its folder's files are sent again. */
const useEdits = (edits: Edits) =>
  useSyncExternalStore(
    (listener) => {
      edits.listeners.add(listener);
      return () => edits.listeners.delete(listener);
    },
    () => edits.version,
  );

/** For a component that does not read a source: nothing, and no hook. */
const useNothing = (..._: unknown[]) => undefined;
const useNoForm = () => NO_FORM;
const useNoOperations = () => NO_LAYER;
/** The person signed in, from Root's `user` read: `null` when nobody is, or Root has no such read. */
const useUserRead = (): unknown => useSuspenseQuery(useFramework().user ?? NO_READ).data;
/**
 * The route a view's files read, followed field by field (root.tsx). Each render starts from the
 * view React committed last: one a thrown-away render made is not kept.
 */
function useFollowedRoute(fields: ReadonlySet<string>, rendering: { readonly current: boolean }, committed: Route) {
  const shown = useRef<null | RouteView>(null);
  const view = followRoute(shown.current, fields, rendering, committed);
  useLayoutEffect(() => {
    shown.current = view;
  });
  return view.route;
}
/** The answer of the component's default read. */
const useAnswerOf = (query: null | Read): unknown => useSuspenseQuery(query ?? NO_READ).data;
type Followed = { decided: boolean | undefined; flags: Seen | undefined; parts: Seen | undefined };
/** One subscription to Root's `acl` and `flags` reads, as `combine` shows them to the component. */
const useFollowedReads = (
  combine: (results: readonly Pick<QueryObserverResult, 'data'>[]) => Followed,
  queries: Read[],
): Followed | undefined => useSuspenseQueries({ combine, queries });

export function component(spec: Spec) {
  // Under the dev server, a folder's module runs again when its `i18n.ts`, its placeholder or its
  // error file is edited: its messages are then built from the file as it is now.
  if (HOT && spec.i18n) forgetMessages(spec.path);
  const inView = new Set(spec.reads?.view ?? []);
  const inAcl = new Set(spec.reads?.acl ?? []);
  const inAsync = new Set(spec.reads?.async ?? []);
  const inState = new Set(spec.reads?.state ?? []);
  const inChart = new Set(spec.reads?.chart ?? []);
  const anywhere = (source: string) => [inView, inAcl, inAsync, inState, inChart].some((reads) => reads.has(source));
  // What the component follows, fixed for its life, so each context is read on every render or
  // on none: the locale, when it has messages or reads the locale; the user and the backend's
  // snapshot, when any of its files reads them.
  const followsLocale =
    Boolean(spec.i18n) ||
    ['intl', 'locale', 'i18n'].some((source) => inView.has(source) || inAsync.has(source) || inChart.has(source));
  const keyedByLocale = inAsync.has('intl') || inAsync.has('locale');
  const readsUser = anywhere('user');
  const keyedByUser = inAsync.has('user');
  const readsAcl = anywhere('acl');
  const keyedByAcl = inAsync.has('acl');
  const readsFlags = anywhere('flags');
  const keyedByFlags = inAsync.has('flags');
  const viewReadsRoute = inView.has('route') || inAcl.has('route');
  // The keys on screen, for a component that lists them.
  const readsKeyboard = inView.has('keyboard');
  // Whether its render, props.ts, handlers or keys read `async`: only then can an operation's
  // state, which changes on the same function, reach what the render shows.
  const viewReadsAsync = inView.has('async') || inView.has('*');
  // An acl.ts that reads only `acl` (the snapshot, and what is inherited) and `flags` is a rule of
  // the folder, the same for every instance: it is decided where the snapshot and the flags are
  // read, and an instance renders again only when its decision changes, not every time the snapshot
  // or a flag does (a sign-in re-decides a delete link in every row, and renders none whose answer
  // stays the same).
  const folderRule = inAcl.size > 0 && [...inAcl].every((name) => name === 'acl' || name === 'flags');
  // A rule that reads the chart's state is decided after the chart; any other, before it, so the
  // chart's declaration and its guards see this render's decision.
  const ruleReadsState = inAcl.has('state') || inAcl.has('*');
  // The placeholder and the error file show the folder's messages too, so the component's
  // wrapper reads them when the folder has both.
  const fallbacksSpeak = Boolean(spec.i18n) && Boolean(spec.placeholder || spec.error);
  // The hooks this type calls, chosen here from what the folder's files read.
  const useUser = readsUser ? useUserRead : useNothing;
  const useFollowed = readsAcl || readsFlags ? useFollowedReads : useNothing;
  const useKeys = readsKeyboard ? useKeyboard : useNothing;
  const useRouteView = viewReadsRoute ? useFollowedRoute : useNothing;
  // And one chosen when the view has loaded: whether it has a default read. A view with none has
  // no query: a stand-in would cost every such component a subscription.
  let useAnswer: (query: null | Read) => unknown = useNothing;
  // And whether it has a handlers.ts: then the hook the plugin wrote from it.
  let useHandlers: (given: Props, scope: Scope) => Props | undefined = useNothing;
  let useForm: typeof useFormLayer | typeof useNoForm = useNoForm;
  let useAsync: typeof useOperations = useNoOperations;
  /** What follows from a view's files, taken when it has loaded. */
  const taken = (module: ViewModule) => {
    useAnswer = typeof module.async?.default === 'function' ? useAnswerOf : useNothing;
    useHandlers = module.handlers?.useHandlers ?? useNothing;
    useForm = module.form ? useFormLayer : useNoForm;
    useAsync = Object.keys(module.async ?? NO_LAYER).some((name) => name !== 'default')
      ? useOperations
      : useNoOperations;
    for (const child of module.children ?? []) child.preload?.();
    return module;
  };
  let view: Promise<ViewModule> | undefined;
  // Once the view has loaded, the components it shows start loading theirs, so a child does not
  // wait to render before its own view starts, and React does not render its parent again when
  // that view arrives.
  const loadView = () => (view ??= tracked(hold(spec.view().then(taken))));
  // Under the dev server, an edit to one of the view's files (the render, props.ts, the chart…)
  // sends the view again (the plugin's module for the folder accepts it). Every instance on screen
  // then renders with the new files and keeps what it holds: what was typed in its fields, its
  // chart's state when the new chart has that state, its open dialog. An edit that gives the view a
  // default read, chart, form or first named operation, or takes one away, changes the hooks it
  // calls: those instances are mounted again. Production builds have none of this.
  const edits: Edits = { listeners: new Set(), version: 0 };
  const useEdited = HOT ? useEdits : useNothing;
  const replace = (module: ViewModule) => {
    view = Object.assign(Promise.resolve(taken(module)), { status: 'fulfilled' as const, value: module });
    edits.version += 1;
    for (const listener of edits.listeners) listener();
  };
  /** The same for a skin: its sheet takes the CSS as the file has it now. */
  const restyle = (skin: string, module: SkinModule) => replaceSkin(spec.path, skin, module.default);
  /** Starts loading the view, the page's skin and the messages, ahead of the first render. */
  const preload = () => {
    void loadView();
    if (spec.i18n) void loadMessages(spec, activeLocale());
    const skin = activeSkin();
    const loadThisSkin = spec.skins[skin];
    if (loadThisSkin) void loadSkin(spec.path, skin, loadThisSkin);
  };

  /**
   * The locale, the folder's messages in it and react-intl's `intl`, for a component that reads
   * them. The messages may still be loading: the component waits for them, as for its view.
   */
  function useLanguage() {
    const locale = followsLocale ? use(LocaleContext) : SOURCE_LOCALE;
    const messages = spec.i18n ? use(loadMessages(spec, locale)) : undefined;
    // While on screen, a change of locale loads this folder's messages before it shows.
    useLayoutEffect(() => (spec.i18n ? showing(spec) : undefined), []);
    return useMemo(
      () => ({
        i18n: messages,
        intl: followsLocale ? intlFor(locale) : undefined,
        locale: followsLocale ? locale : undefined,
      }),
      [locale, messages],
    );
  }

  /** Every layer of the view but the state layer, called in the same order on every render. */
  function useLayers(props: Props) {
    const { acl: aclRead, data, fields, flags: flagsRead, injection, skin, sources } = useFramework();
    const language = useLanguage();
    // The person signed in, from Root's `user` read: a sign-in or a sign-out makes it stale, and
    // only the components that read it render again.
    const user = useUser();
    const module = use(loadView());
    const inherited = readsAcl || module.acl ? use(AclContext) : true;
    // The parts of the backend's snapshot and of the flags this component's files read, recorded as
    // they read them (reads.ts). The component follows those parts, and its folder rule's decision:
    // one subscription to both reads, which renders it again only when what `combine` returns
    // changes. Each part is compared with what this component last rendered, so the keys a render
    // first reads count from the first change on.
    const keys = useRef(new Set<string>()).current;
    const flagKeys = useRef(new Set<string>()).current;
    const views = useRef(new WeakMap<object, Allowed>()).current;
    const flagViews = useRef(new WeakMap<object, Flags>()).current;
    const view = useCallback(
      (acl: Allowed) => {
        let tracked = views.get(acl);
        if (!tracked) views.set(acl, (tracked = tracking(acl, keys)));
        return tracked;
      },
      [views, keys],
    );
    const flagsView = useCallback(
      (flags: Flags) => {
        let tracked = flagViews.get(flags);
        if (!tracked) flagViews.set(flags, (tracked = tracking(flags, flagKeys)));
        return tracked;
      },
      [flagViews, flagKeys],
    );
    const rule = folderRule ? module.acl?.default : undefined;
    // Which of Root's reads this component subscribes to, in a fixed order: whether it reads each is
    // fixed for its type, and whether Root has each, for Root's life.
    const aclAt = readsAcl && aclRead ? 0 : -1;
    const flagsAt = readsFlags && flagsRead ? aclAt + 1 : -1;
    const seen = useRef<{ acl: null | Seen; flags: null | Seen }>({ acl: null, flags: null }).current;
    const combine = useCallback(
      (results: readonly Pick<QueryObserverResult, 'data'>[]) => {
        const snapshot = aclAt < 0 ? NO_SNAPSHOT : results[aclAt]?.data;
        const flags = (flagsAt < 0 ? NO_FLAGS : results[flagsAt]?.data) as Flags;
        return {
          decided: rule ? decide(rule, { acl: allowedOn(snapshot, inherited), flags }) : undefined,
          flags: readsFlags ? seenOf(seen.flags, flags, flagKeys) : undefined,
          parts: readsAcl ? seenOf(seen.acl, snapshot, ofSnapshot(keys)) : undefined,
        };
      },
      [rule, inherited, keys, flagKeys, aclAt, flagsAt, seen],
    );
    const subscribed = useMemo(
      () => [...(aclAt < 0 ? [] : [aclRead!]), ...(flagsAt < 0 ? [] : [flagsRead!])],
      [aclAt, aclRead, flagsAt, flagsRead],
    );
    const followed = useFollowed(combine, subscribed);
    // What this render shows: a later change is compared with it.
    if (followed) {
      seen.acl = followed.parts ?? null;
      seen.flags = followed.flags ?? null;
    }
    const latest = useCallback(
      () => (aclRead ? data.client.getQueryData(aclRead.queryKey) : NO_SNAPSHOT),
      [aclRead, data],
    );
    const latestFlags = useCallback(
      () => ((flagsRead ? data.client.getQueryData(flagsRead.queryKey) : undefined) ?? NO_FLAGS) as Flags,
      [flagsRead, data],
    );
    const snapshot = readsAcl ? latest() : undefined;
    const flagged = readsFlags ? latestFlags() : undefined;
    // Whether this instance is rendering now: what its files and its chart read during the render
    // is this render's (the route being rendered, the decision); what runs after it, the committed.
    const rendering = useRef(false);
    // The route its files read, followed field by field (root.tsx).
    const route = useRouteView(fields, rendering, sources.route);
    const keyboard = useKeys();
    // The decision, twice. `judged` is this render's, for what runs inside the render: the chart's
    // declaration, and its first reads when it is created. `decided` is the one React committed,
    // for what runs later: the chart's guards and the operations. A render React throws away (a
    // transition the person leaves before it arrives) sets the first and never the second, so a
    // guard reads the decision the page shows.
    const judged = useRef<boolean>(inherited);
    const decided = useRef<boolean>(inherited);
    const loadThisSkin = spec.skins[skin];
    if (loadThisSkin) use(loadSkin(spec.path, skin, loadThisSkin));

    const parent = use(ScopeContext);
    const scope = useMemo(() => ({ parent, path: spec.path }), [parent]);
    const { locale } = language;
    const injected = useMemo(() => {
      const all: Record<string, unknown> = { ...injection, ...sources, ...defined(language), ...defined({ user }) };
      // Getters: the chart's guards and the operations spread these when they run, and get the
      // snapshot, the decision and the flags of that moment.
      if (readsAcl)
        Object.defineProperty(all, 'acl', {
          enumerable: true,
          get: () => view(allowedOn(latest(), (rendering.current ? judged : decided).current)),
        });
      if (readsFlags) Object.defineProperty(all, 'flags', { enumerable: true, get: () => flagsView(latestFlags()) });
      return all;
    }, [injection, sources, language, user, view, latest, flagsView, latestFlags]);

    // The default export of async.ts, as a query: it records the services and route parameters
    // it reads, so the data layer knows when to run it again. It gets the query's signal, which
    // aborts when nothing shows the read any more, as the named exports get theirs on unmount.
    // Until the read has run once, the component reads the whole route. After that it reads only
    // the fields that first run read, each from its own context (root.tsx), so a change of another
    // field (a dialog opening over the list) does not render it again. `use` may read a context
    // behind a condition: whether the view has a default read is fixed once it has loaded, and
    // the fields it reads, once it has run.
    const exported = module.async?.default;
    const learned = typeof exported === 'function' ? data.fieldsOf(spec.path) : undefined;
    const routeShown = useRef<null | Record<string, unknown>>(null);
    const readRoute = ((): null | Record<string, unknown> => {
      if (typeof exported !== 'function') return null;
      if (!learned) return use(RouteContext) as unknown as Record<string, unknown>;
      const values: Record<string, unknown> = {};
      for (const key of learned)
        values[key] = fields.has(key)
          ? use(fieldContext(key))
          : (use(RouteContext) as unknown as Record<string, unknown>)[key];
      // The same fields with the same values as React committed last are the same object, so the
      // query below stays the same.
      const last = routeShown.current;
      return last && sameRoute(last, values) ? last : values;
    })();
    const userId = (user as null | undefined | { id?: unknown })?.id ?? null;
    const query = useMemo(
      () =>
        typeof exported !== 'function' || readRoute === null
          ? null
          : data.component(
              spec.path,
              readRoute,
              (record, signal) =>
                execute(
                  exported,
                  {
                    ...injected,
                    // A field the first run did not read is outside the query's key: a later run gets it as committed.
                    route: recordingRoute(
                      learned ? { ...(sources.route as unknown as Record<string, unknown>), ...readRoute } : readRoute,
                      record.route,
                    ),
                    services: recording(injection.services, record.service, record.peek),
                    signal,
                  },
                  [],
                ),
              keyedByLocale || keyedByUser || keyedByAcl || keyedByFlags
                ? defined({
                    acl: keyedByAcl ? snapshot : undefined,
                    flags: keyedByFlags ? flagged : undefined,
                    locale: keyedByLocale ? locale : undefined,
                    user: keyedByUser ? userId : undefined,
                  })
                : undefined,
            ),
      [data, exported, injection, injected, readRoute, learned, sources, locale, userId, snapshot, flagged],
    );
    // A view with no default read has no query, and `useAnswer` is then no hook at all: which of
    // the two it is was chosen when the view loaded.
    const answer = useAnswer(query);
    // An answer keeps every part equal to the last answer this component showed, under any key,
    // so a child given an equal part gets the same object and its memo holds.
    const shown = useRef<unknown>(undefined);
    const initial = useMemo(
      () => (shown.current === undefined ? answer : shareByIdentity(shown.current, answer)),
      [answer],
    );
    useLayoutEffect(() => {
      shown.current = initial;
      routeShown.current = readRoute;
    }, [initial, readRoute]);

    // A component held in one state in the states gallery starts its form with the example's values.
    const pin = use(PinContext);
    // The render follows the values it reads; the chart and the operations read the latest when they run.
    // A seed that reads the props follows them (form.ts).
    const { latest: running, view: form } = useForm(
      module.form ?? NO_LAYER,
      pin?.path === spec.path ? pin.example?.values : undefined,
      props,
    );
    const withForm = useMemo(
      () => (module.form ? { ...injected, form: running } : injected),
      [injected, running, module.form],
    );
    const operations = useAsync(spec.path, module.async, withForm);
    const hasRead = query !== null;
    const async = useMemo(
      () => module.async && { ...operations, ...(hasRead ? { default: initial } : {}) },
      [module.async, operations, hasRead, initial],
    );
    const flags = flagged && flagsView(flagged);
    const access = useMemo(
      () => ({
        decided: followed?.decided,
        flagged,
        flags,
        given: defined({ flags, keyboard, route, user }),
        inherited,
        snapshot,
        user,
        view,
      }),
      [user, flags, flagged, route, keyboard, inherited, followed, snapshot, view],
    );
    return {
      access,
      async,
      decided,
      fields,
      form,
      injection,
      judged,
      language,
      module,
      operations,
      rendering,
      scope,
      sources,
      withForm,
    };
  }

  /** Runs a rule. A rule that throws refuses, and is reported as the acl layer's failure. */
  function decide(rule: unknown, given: Props): boolean {
    try {
      return Boolean((rule as (given: Props) => unknown)(given));
    } catch (thrown) {
      report(thrown, { layer: 'acl', path: spec.path });
      return false;
    }
  }

  /** What a render, props.ts and acl.ts get from the props and the layers. */
  function givenOf(props: Props, layers: ReturnType<typeof useLayers>, state: unknown, className: string): Props {
    const { access, async, form, language, module } = layers;
    return {
      ...props,
      className,
      ...(async ? { async } : {}),
      ...(state ? { state } : {}),
      ...(module.form ? { form } : {}),
      ...defined(language),
      ...access.given,
    };
  }

  /**
   * This instance's decision: its folder rule's, already decided where the snapshot is read; its
   * own acl.ts's, from what props.ts would get, the route and the snapshot with what is inherited
   * on it; or what it inherits.
   */
  function decisionOf(module: ViewModule, given: Props, access: ReturnType<typeof useLayers>['access']): boolean {
    if (access.decided !== undefined) return access.decided;
    const rule = module.acl?.default;
    if (typeof rule !== 'function') return access.inherited;
    return decide(rule, { ...given, acl: access.view(allowedOn(access.snapshot, access.inherited)) });
  }

  /** What props.ts gets in this render, with this render's decision on it. */
  function worked(props: Props, layers: ReturnType<typeof useLayers>, state: unknown, decided?: boolean) {
    const { access, module } = layers;
    const className = classes(spec.path, props.className);
    const given = givenOf(props, layers, state, className);
    const allowed = decided ?? decisionOf(module, given, access);
    const shaping = readsAcl ? { ...given, acl: access.view(allowedOn(access.snapshot, allowed)) } : given;
    return { allowed, className, shaping };
  }

  /**
   * Calls the render as a plain function, inside the component instance's scope. A render and its
   * props.ts are pure functions of what they get, with no hooks, so a render that would get what
   * the last one got gives the same output: the framework returns that output again, and React
   * skips everything inside it.
   *
   * What the render gets (props.ts's output, or the props and layers) keeps every part of what it
   * got last time that is still equal, as a read's answer does. So a change that leaves what the
   * render shows as it was (a parent's new array with the same items, a state that changed
   * nothing the render reads) does not call the render either, and a part that did not change
   * keeps its identity, so react-aria's collections and memoized children inside skip it.
   */
  function useShow(props: Props, layers: ReturnType<typeof useLayers>, state: unknown, decided?: boolean) {
    const { access, async, decided: committed, form, judged, language, module, operations, rendering, scope } = layers;
    // What React committed last: the render before this one that reached the page. A render React
    // throws away leaves it as it was, so the next one is compared with what the page shows, and
    // shares its elements with it.
    const last = useRef<null | Shown>(null);
    // The last render worked out, committed or not. While something beside a component is still
    // loading, React renders the component again with what it was given before, as often as
    // another commit lands, and each time gets the output worked out the first time, without the
    // render being called. It answers only for the same inputs, so a thrown-away render's output
    // is returned only where a render would return the same.
    const tried = useRef<null | Shown>(null);
    // What this render shows, kept when React commits it.
    let next: null | Shown = null;
    let showing: boolean | undefined;
    // The handlers of the render React committed are the ones the instance's wrappers call.
    useLayoutEffect(() => commitHandlers(scope));
    // The keys this instance answers, registered after each commit while it is mounted.
    const registered = useRef<Entry[] | undefined>(undefined);
    useLayoutEffect(() => {
      // Its decision is the one the guards and the operations read.
      if (showing !== undefined) committed.current = showing;
      if (next) last.current = next;
      if (next?.keys) registered.current = next.keys;
    });
    useShortcuts(spec.path, scope, registered);
    // A folder with a handlers.ts: the hook the plugin wrote from it holds one `useCallback` per
    // export, whose dependencies are what the export reads. It reads them from what this render
    // gives the folder's files, so that is worked out first, at every render, and the callbacks are
    // this render's: React keeps them with the render it commits, and drops them with one it
    // throws away. A handler gets what props.ts gets, and handles to what lives outside React: the
    // form's store (read when the handler runs), the navigation, the services and the entity. The
    // route is the one being rendered: the fields the handlers read, each from its own context, so
    // the component follows those; or all of it, for a handler that takes it whole.
    const wiring = module.handlers;
    const first = wiring ? during(rendering, () => worked(props, layers, state, decided)) : undefined;
    const handlers = useHandlers(
      first && wiring
        ? {
            ...first.shaping,
            ...(module.form ? { form: layers.withForm.form } : {}),
            ...(wiring.route
              ? { route: wiring.route === 'whole' ? use(RouteContext) : renderingRoute(layers.fields) }
              : {}),
            entity: layers.sources.entity,
            navigation: layers.sources.navigation,
            services: layers.injection.services,
          }
        : props,
      scope,
    );
    // What the files read while the render runs is this render's (`during`).
    const element = during(rendering, () => {
      // Other files (an edit under the dev server) are another render: nothing before compares with it.
      const from = (known: null | Shown) => (known?.module === module ? known : null);
      const before = from(last.current);
      const inputs = [scope, async, state, form, language, access, decided, handlers];
      const again = [before, from(tried.current)].find(
        (known) => known && sameEach(known.inputs, inputs) && sameProps(known.props, props),
      );
      if (again) {
        judged.current = again.allowed;
        showing = again.allowed;
        if (again !== before) next = again;
        return again.element;
      }
      const { allowed, className, shaping } = first ?? worked(props, layers, state, decided);
      judged.current = allowed;
      showing = allowed;
      // shortcuts.ts gets what props.ts gets. Its keys follow the state even when the render is skipped.
      const keys = module.shortcuts
        ? shortcutsOf(spec.path, module.shortcuts, shaping, state as never, scope, module.shortcutSites)
        : undefined;
      const output = shape(module, shaping, className);
      if (handlers && import.meta.env.DEV && (Object.hasOwn(props, 'handlers') || Object.hasOwn(output, 'handlers')))
        throw new Error(`${spec.path}: handlers is reserved for handlers.ts`);
      // The framework's own comparison reads every key; it records none.
      const shaped = untracked(() =>
        shareByIdentity(before?.shaped, handlers ? { ...output, handlers } : output),
      ) as Props;
      if (
        before &&
        shaped === before.shaped &&
        allowed === before.allowed &&
        (!viewReadsAsync || operations === before.operations)
      ) {
        next = { ...before, inputs, keys, props };
        return before.element;
      }
      // Or what the last render worked out was given, when React has not committed that one (yet).
      const retried = from(tried.current);
      if (
        retried &&
        retried !== before &&
        allowed === retried.allowed &&
        (!viewReadsAsync || operations === retried.operations)
      ) {
        const same = untracked(() => shareByIdentity(retried.shaped, shaped));
        if (same === retried.shaped) {
          next = { ...retried, inputs, keys, props };
          return retried.element;
        }
      }
      // What did not change since the last output is the element React showed then, and it skips it.
      const rendered = shareElements(
        before?.rendered,
        withScope(scope, () => module.render(shaped)),
      ) as ReactNode;
      // The same output with the same decision, in the same scope, is the element React showed, and it
      // renders nothing below.
      if (before && rendered === before.rendered && allowed === before.allowed && scope === before.scope) {
        next = { ...before, inputs, keys, operations, props, shaped };
        return before.element;
      }
      // What this folder's acl.ts decided reaches every component below, until one of them decides otherwise.
      const element = createElement(
        ScopeContext,
        { value: scope },
        module.acl ? createElement(AclContext, { value: allowed }, rendered) : rendered,
      );
      next = { allowed, element, inputs, keys, module, operations, props, rendered, scope, shaped };
      return element;
    });
    // What this render worked out answers the next one given the same (`tried`).
    if (next) tried.current = next;
    return element;
  }

  /** What `props.ts` returns, with the `className`; a failure there is reported as the props layer's. */
  function shape(module: ViewModule, given: Props, className: string): Props {
    const shaping = module.props?.default;
    if (typeof shaping !== 'function') return given;
    try {
      return { className, ...(shaping as (props: Props) => Props)(given) };
    } catch (thrown) {
      throw report(thrown, { layer: 'props', path: spec.path });
    }
  }

  // A folder with a state.ts and one without render through different components, so neither
  // calls a hook behind a condition. The view's module, once loaded, decides which.
  function StatefulView(props: Props) {
    const layers = useLayers(props);
    const { access, judged, language, module, rendering } = layers;
    // The decision comes before the chart, so its declaration and its guards see this render's.
    // A rule that reads the chart's state is decided after it, in useShow.
    const early = ruleReadsState
      ? undefined
      : during(rendering, () =>
          decisionOf(module, givenOf(props, layers, undefined, classes(spec.path, props.className)), access),
        );
    if (early !== undefined) judged.current = early;
    // What the declaration may read, besides the injection: the chart is declared again when a
    // part it read changes, and keeps its place (machine.ts).
    const declared = defined({
      acl: readsAcl ? access.view(allowedOn(access.snapshot, judged.current)) : undefined,
      flags: access.flags,
      user: access.user,
      ...language,
    });
    // The route being rendered, for the chart's first reads (machine.ts), read only until the
    // component's first commit, and field by field: the commit follows only the fields the chart
    // read, and after it a change of route does not render the component again.
    // The sources state.ts reads, each told to the chart by an event of its name when it changes.
    const told = defined({
      acl: inState.has('acl') ? access.snapshot : undefined,
      flags: inState.has('flags') ? access.flagged : undefined,
      locale: inState.has('locale') ? language.locale : undefined,
      user: inState.has('user') ? access.user : undefined,
    });
    const state = useStateLayer(
      spec.path,
      module.state as StateModule,
      layers.injection,
      declared,
      layers.withForm,
      () => renderingRoute(layers.fields),
      told,
      layers.rendering,
    );
    return useShow(props, layers, state, early);
  }
  function StatelessView(props: Props) {
    return useShow(props, useLayers(props), undefined);
  }
  StatefulView.displayName = spec.path;
  StatelessView.displayName = spec.path;

  function View(props: Props) {
    useEdited(edits);
    const module = use(loadView());
    const Chosen = module.state ? StatefulView : StatelessView;
    // The key says which hooks the view calls, so an edit that changes them mounts it again.
    return createElement(
      Chosen,
      HOT
        ? {
            ...props,
            key: `${useAnswer === useAnswerOf ? 'read' : 'none'} ${module.form ? 'form' : 'none'} ${useAsync === useOperations ? 'operations' : 'none'} ${module.handlers?.shape ?? ''}`,
          }
        : props,
    );
  }
  View.displayName = spec.path;

  const { error: ErrorFallback, placeholder: Placeholder } = spec;

  const useFallbackLanguage = fallbacksSpeak ? useLanguage : useNothing;

  function Component(props: Props) {
    const className = classes(spec.path, props.className);
    const { reset } = useQueryErrorResetBoundary();
    const parent = use(ScopeContext);
    const spoken = useFallbackLanguage();
    const language = spoken ? defined(spoken) : null;
    let tree: ReactNode = createElement(View, props);
    if (Placeholder)
      tree = createElement(
        Suspense,
        { fallback: createElement(Pending, null, createElement(Placeholder, { ...props, className, ...language })) },
        tree,
      );
    if (ErrorFallback) {
      tree = createElement(ErrorBoundary, {
        children: tree,
        // The fallback gets an `Error` whatever was thrown, and a reset that takes no arguments.
        // While it shows, a new address tries again (Retrying).
        fallbackRender: (fallback: FallbackProps) =>
          createElement(
            Retrying,
            { retry: fallback.resetErrorBoundary },
            createElement(ErrorFallback, {
              ...props,
              className,
              ...language,
              error: toError(fallback.error),
              resetErrorBoundary: () => fallback.resetErrorBoundary(),
            }),
          ),
        onError: (error: unknown) =>
          report(error, { chain: [...chainOf(parent), spec.path], layer: 'render', path: spec.path }),
        onReset: reset,
      });
    }
    return tree;
  }
  Component.displayName = `${spec.path} (wrapper)`;

  // A render is a pure function of what props.ts works out from the props and the layers, so a
  // parent's re-render that passes the same props (shallowly) changes nothing here. The layers'
  // own changes (state, operations, data, the framework's context) still re-render it.
  return Object.assign(memo(Component), { preload, ...(HOT ? { replace, restyle } : {}) });
}
