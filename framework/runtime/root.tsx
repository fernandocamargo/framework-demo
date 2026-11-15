/**
 * `Root`: composes what the framework provides: the injection, the data layer (one
 * TanStack Query client), the sources the state and async layers read (`entity`, `route`,
 * `navigation`), the reads every layer may follow (`user`, `acl`, `flags`), the page's skin, and the app's global error listeners, the
 * last resort of the error pipeline. A `Suspense` at the top catches components with no
 * placeholder.
 */

import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type Context,
  createContext,
  createElement,
  type ReactNode,
  Suspense,
  use,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { hold, Pending, useCommitted, watch } from './activity';
import { createDataLayer, createQueryClient, type DataLayer, recording } from './data';
import { activateLocale, loadShown, LocaleContext, SOURCE_LOCALE } from './i18n';
import type { Acl, Entity, Env, Flags, Navigation, Route, User } from './index';
import { createInjection, type Injection } from './injection';
import { report, setLocation } from './pipeline';
import { isTracking } from './reads';
import { listenToKeys } from './shortcuts';
import { activateSkin } from './style';

type Sources = { entity: Entity; navigation: Navigation; route: Route };
/** The query of one of Root's reads (`user`, `acl`, `flags`), which the components that read it share. */
type Read = ReturnType<DataLayer['component']>;
type Framework = {
  acl: null | Read;
  data: DataLayer;
  /** The fields of the route that have a context of their own: those of the first route this Root rendered. */
  fields: ReadonlySet<string>;
  flags: null | Read;
  injection: Injection;
  skin: string;
  sources: Sources;
  user: null | Read;
};

const FrameworkContext = createContext<Framework | null>(null);
FrameworkContext.displayName = 'Framework';

export function useFramework() {
  const framework = useContext(FrameworkContext);
  if (!framework) throw new Error('A framework component rendered outside <Root>');
  return framework;
}

// With no keys declared by the app, empty objects are valid.
const NONE = {} as never;

/**
 * The route as the render sees it, whole: for a view that reads the route, a field that has no
 * context of its own, and a default read before its first run says which fields it reads.
 */
export const RouteContext = createContext<Route>(NONE);
RouteContext.displayName = 'Route';

/**
 * Each field of the route in a context of its own. A default read follows the fields its first run
 * read (`route.q`, `route.page`), so a change of another field (a dialog opening) does not render
 * it again. React has no selector for a context: a component that reads one renders again whenever
 * its value changes, so each field gets its own.
 */
const fieldContexts = new Map<string, Context<unknown>>();
export function fieldContext(key: string): Context<unknown> {
  let found = fieldContexts.get(key);
  if (!found) {
    fieldContexts.set(key, (found = createContext<unknown>(undefined)));
    found.displayName = `Route.${key}`;
  }
  return found;
}

/**
 * A field of the route being rendered, from its own context when it has one, and from the whole
 * route when it has none; `*` is the whole route. This is the one place the framework reads a
 * context on demand: a component follows the fields its files read, and which those are is known
 * only as they read them, through a Proxy, while it renders. `use` is the hook React lets a render
 * call behind a condition, but a lint cannot see that this function runs only during a render:
 * `followRoute` guards it with `rendering`, and a chart reads `renderingRoute` only while its
 * component's first render creates it.
 */
function reading(fields: ReadonlySet<string>, key: string): unknown {
  const own = key !== '*' && fields.has(key);
  const value = use(own ? fieldContext(key) : (RouteContext as unknown as Context<unknown>));
  return own || key === '*' ? value : (value as Record<string, unknown>)[key];
}

/**
 * The route being rendered, read field by field as it is read: the component follows the fields it
 * read, and no other, until it renders again. Read it during a render only (`use` reads contexts).
 * Its keys, and spreading it, read the whole route.
 */
export function renderingRoute(fields: ReadonlySet<string>): Route {
  const whole = () => reading(fields, '*') as object;
  const field = (key: string | symbol) =>
    typeof key === 'string' && fields.has(key) ? { value: reading(fields, key) } : null;
  return new Proxy({} as Route, {
    get: (_, key) => (field(key) ?? { value: Reflect.get(whole(), key) }).value,
    getOwnPropertyDescriptor: (_, key) => {
      const own = field(key);
      if (own) return { configurable: true, enumerable: true, value: own.value, writable: false };
      const descriptor = Reflect.getOwnPropertyDescriptor(whole(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
    has: (_, key) => (typeof key === 'string' && fields.has(key)) || Reflect.has(whole(), key),
    ownKeys: () => Reflect.ownKeys(whole()),
  });
}

/** The route a component's files read, and the fields they read through it, with their values. */
export type RouteView = { read: Map<string, unknown>; route: Route };

/**
 * The route for a component's files (`props.ts`, the render, `acl.ts`), followed field by field.
 * Each render reads again, from its context, every field the files read through the last view:
 * that keeps the component following them while its render is skipped, and when one of them
 * changed it gets a new view, so its files run again and read what they need. A field nobody read
 * renders nothing. Read during a render, the view reads the route being rendered; read after it
 * (a handler, a key), the committed route. Its keys, and spreading it, read the whole route.
 */
export function followRoute(
  last: null | RouteView,
  fields: ReadonlySet<string>,
  rendering: { readonly current: boolean },
  committed: Route,
): RouteView {
  const whole = () => reading(fields, '*') as Record<string, unknown>;
  const field = (key: string) => reading(fields, key);
  if (last) {
    let same = true;
    // Every field is read, not only up to the first that changed, so the component keeps following all of them.
    for (const [key, value] of last.read) if (!Object.is(field(key), value)) same = false;
    if (same) return last;
  }
  const read = new Map<string, unknown>();
  const now = (key: string) => {
    if (!rendering.current) return (committed as unknown as Record<string, unknown>)[key];
    const value = field(key);
    if (isTracking()) read.set(key, value);
    return value;
  };
  const route = new Proxy({} as Route, {
    get: (_, key) => (typeof key === 'string' ? now(key) : undefined),
    getOwnPropertyDescriptor: (_, key) =>
      typeof key === 'string' && Reflect.has(committed, key)
        ? { configurable: true, enumerable: true, value: now(key), writable: false }
        : undefined,
    has: (_, key) => Reflect.has(committed, key),
    ownKeys: () => {
      if (!rendering.current) return Reflect.ownKeys(committed);
      const all = whole();
      if (isTracking()) read.set('*', all);
      return Reflect.ownKeys(all);
    },
  });
  return { read, route };
}

/** A view of `ref.current` as if it were the object itself: reading, `in`, keys and spreading. */
function liveView<T extends object>(ref: { readonly current: T }): T {
  return new Proxy({} as T, {
    get: (_, key) => Reflect.get(ref.current, key),
    getOwnPropertyDescriptor: (_, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(ref.current, key);
      return descriptor && { ...descriptor, configurable: true };
    },
    has: (_, key) => Reflect.has(ref.current, key),
    ownKeys: () => Reflect.ownKeys(ref.current),
  });
}

export type RootProps = {
  /**
   * What the backend says may be done: a snapshot the app does not own (roles, grants, limits),
   * read from the services (`({ services }) => services.auth.permissions()`). The framework only
   * carries it: every component file and chart declaration that reads `acl` gets it, with
   * `allowed` on it, the decision of the nearest `acl.ts` above, and follows only the parts of it
   * it reads. Like `user`, it runs through the data layer, so a sign-in or a sign-out reads it
   * again. Keep the function stable.
   */
  acl?: (injection: Injection & { signal: AbortSignal }) => Promise<Acl>;
  children?: ReactNode;
  /**
   * The query client the framework's data lives in, made with `createQueryClient()`. Give Root one
   * the app keeps for its life, and a page's reads stay cached when the page goes and comes back
   *; leave it out, and Root makes one for its own life.
   */
  client?: QueryClient;
  /** The selected entity. Services read `entity.id` when they run. */
  entity?: Entity;
  /** What clients receive as `env`. Keep the object stable: a new one rebuilds every client. */
  env?: Env;
  /**
   * The feature flags for the person signed in: a read of the services, given that person as the
   * `user` read names them (`({ services, user }) => services.flags.evaluate(…)`). Every component
   * file and chart declaration that reads `flags` gets them, waits for them the first time, and
   * follows only the flags it reads. It runs through the data layer and reads the person the way
   * the `user` read does, so a sign-in or a sign-out reads it again; a service read that follows
   * its source (`follows` in `meta.ts`) reads it again when a flag changes. Keep the function stable.
   */
  flags?: (injection: Injection & { signal: AbortSignal; user: null | User }) => Promise<Flags>;
  /**
   * The locale the page shows (`pt-BR`). A component with an `i18n.ts`, or one that reads `intl`
   * or `locale`, follows it, and no other. When it changes, the page keeps the old locale on
   * screen until every component on it has its messages in the new one, then shows it at once.
   */
  locale?: string;
  /**
   * Where the app is, as its router says (`/products/12?status=low`). Failures and
   * interactions carry it. Leave it out when the address's hash holds the route.
   */
  location?: string;
  /** How components move between routes. A stand-in until the routing layer is designed. */
  navigation?: Navigation;
  /** The current route's parameters. A stand-in until the routing layer is designed. */
  route?: Route;
  /** The skin of the whole page. */
  skin?: string;
  /**
   * The name of the channel the app's tabs share (`stockroom`). With one, a write that succeeds in
   * a tab makes the same reads stale in the others, so they read them again: a save, a sign-in or
   * a sign-out in one tab reaches every tab. Leave it out, and each tab is on its own.
   */
  sync?: string;
  /**
   * Who is signed in: a read of the services, such as the session and then the profile it names
   * (`({ services }) => …`), resolving to the person or `null`. Components whose files read
   * `user` get it, and wait for it the first time. It runs through the data layer, so a write that
   * makes one of the services it read stale (a sign-in, a sign-out) reads it again, and only the
   * components that read `user` render again, if the person changed. Keep the function stable.
   */
  user?: (injection: Injection & { signal: AbortSignal }) => Promise<null | User>;
};

export function Root({
  acl,
  children,
  client: given,
  entity = NONE,
  env = NONE,
  flags,
  locale = SOURCE_LOCALE,
  location,
  navigation = NONE,
  route = NONE,
  skin = 'default',
  sync,
  user,
}: RootProps) {
  // Services were created once and read the entity when they run: the entity on screen, the one
  // React committed. A render React throws away (an entity selected in a transition the person
  // leaves before it arrives) hands nothing to a service that runs meanwhile. So a new entity is
  // taken in two steps: the commit selects it for the services, then the page renders for it,
  // before the browser paints, and its reads are keyed by it and answered for it.
  const current = useRef(entity);
  const [selected, setSelected] = useState(entity);
  useLayoutEffect(() => {
    current.current = entity;
    setSelected(entity);
  }, [entity]);
  const live = useMemo<Entity>(
    () => new Proxy({} as Entity, { get: (_, key) => Reflect.get(current.current as object, key) }),
    [],
  );
  // Root makes a client only when the app gives none, once for its life.
  const own = useRef<null | QueryClient>(null);
  const client = given ?? (own.current ??= createQueryClient());
  // Its reads and writes count as pending for `whenIdle()` while this Root uses it.
  useEffect(() => watch(client), [client]);
  const data = useMemo(() => createDataLayer(client, live as { readonly id: string }), [client, live]);
  const injection = useMemo(() => createInjection(env, live, data), [env, live, data]);
  // The other tabs of the app, through one channel per client.
  useEffect(() => (sync ? data.share(sync) : undefined), [data, sync]);
  // After the commit and before the paint, so a render React throws away changes nothing. The
  // sheets added before it are set again here, before anyone sees them.
  useLayoutEffect(() => activateSkin(skin), [skin]);
  // Operations and state charts read the route when they run: the route on screen, committed. So
  // the sources the framework's context carries stay the same object when the route changes.
  const committedRoute = useRef(route);
  useLayoutEffect(() => {
    committedRoute.current = route;
  }, [route]);
  const liveRoute = useMemo(() => liveView(committedRoute), []);
  const sources = useMemo(
    () => ({ entity: selected, navigation, route: liveRoute }),
    [selected, liveRoute, navigation],
  );
  // A new route counts as pending for `whenIdle()` until React commits it: a navigation in a
  // transition keeps the old page on screen with no placeholder while React renders the new one.
  useCommitted(route);
  // Loads started outside a render (a view preloading its children's) use the locale asked for,
  // so a change of locale starts loading the new messages as early as it can.
  activateLocale(locale);
  // The locale on screen follows the one asked for once the messages of every component on
  // screen are loaded in it: one commit, nothing suspending. React loses a change of context
  // for a component whose sibling suspends in the same update, so the framework never lets a
  // change of locale suspend.
  const [shown, setShown] = useState(locale);
  useEffect(() => {
    if (shown === locale) return;
    let current = true;
    void hold(loadShown(locale)).then(
      () => current && setShown(locale),
      () => current && setShown(locale),
    );
    return () => {
      current = false;
    };
  }, [locale, shown]);
  useCommitted(shown);
  // Root's reads are keyed by the entity, as every read is: another entity is another person's
  // answer, so each is made again for the entity selected.
  const userRead = useMemo(
    () =>
      user
        ? data.component('framework/user', {}, (record, signal) =>
            user({ ...injection, services: recording(injection.services, record.service, record.peek), signal }),
          )
        : null,
    [data, injection, user, selected],
  );
  const aclRead = useMemo(
    () =>
      acl
        ? data.component('framework/acl', {}, (record, signal) =>
            acl({ ...injection, services: recording(injection.services, record.service, record.peek), signal }),
          )
        : null,
    [data, injection, acl, selected],
  );
  // The flags are for a person: the read runs the `user` read's function too, through the same
  // recording, so it reads what that one reads (cached), and is read again whenever it is.
  const flagsRead = useMemo(
    () =>
      flags
        ? data.component('framework/flags', {}, async (record, signal) => {
            const services = recording(injection.services, record.service, record.peek);
            const person = user ? await user({ ...injection, services, signal }) : null;
            return flags({ ...injection, services, signal, user: person });
          })
        : null,
    [data, injection, user, flags, selected],
  );
  // The fields of the first route rendered each get a context, in the same order for Root's life,
  // so the tree around the page keeps its shape. A field that appears later is read from the whole
  // route (`RouteContext`).
  const fields = useState(() => new Set(Object.keys(route)))[0];
  const framework = useMemo(
    () => ({ acl: aclRead, data, fields, flags: flagsRead, injection, skin, sources, user: userRead }),
    [injection, skin, sources, data, userRead, aclRead, flagsRead, fields],
  );
  // Root's reads start side by side as Root mounts, not each when the first component that reads it
  // renders: a read first needed deep in the tree (the rows' flags) would suspend it there, and
  // React would render the components around it again.
  useEffect(() => {
    for (const read of [userRead, aclRead, flagsRead]) if (read) void data.client.prefetchQuery(read);
  }, [data, userRead, aclRead, flagsRead]);

  // Failures and interactions carry where the app is; setLocation returns what unsets it.
  useEffect(() => (location === undefined ? undefined : setLocation(location)), [location]);

  // The keys the components on screen declare in their shortcuts.ts.
  useEffect(() => listenToKeys(), []);

  // What escapes every layer still reaches the pipeline, unidentified.
  useEffect(() => {
    const onError = (event: ErrorEvent) => report(event.error ?? event.message, { layer: 'global' });
    const onRejection = (event: PromiseRejectionEvent) => report(event.reason, { layer: 'global' });
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  let page: ReactNode = (
    <LocaleContext value={shown}>
      <Suspense fallback={<Pending />}>{children}</Suspense>
    </LocaleContext>
  );
  for (const key of [...fields].reverse())
    page = createElement(fieldContext(key), { value: (route as unknown as Record<string, unknown>)[key] }, page);
  return (
    <QueryClientProvider client={client}>
      <FrameworkContext value={framework}>
        <RouteContext value={route}>{page}</RouteContext>
      </FrameworkContext>
    </QueryClientProvider>
  );
}
