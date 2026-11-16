/**
 * `Root`: composes what the framework provides: the injection, the data layer (one
 * TanStack Query client), the entity and fallback navigation the state and async layers read, the reads every layer may follow (`user`, `acl`, `flags`), the page's skin, and the app's global error listeners, the
 * last resort of the error pipeline. A `Suspense` at the top catches components with no
 * placeholder. The folders it is given get their own boundaries where the shell writes them, from
 * the plugin, as a folder's children do; an element given to it directly by other code (a test)
 * gets them here (boundaries.ts).
 */

import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createContext,
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

import { Pending, useCommitted, watch } from './activity';
import { boundEach } from './boundaries';
import { createDataLayer, type DataLayer, recording } from './data';
import { LocaleContext, SOURCE_LOCALE } from './i18n';
import type { Acl, Entity, Env, Flags, Navigation, User } from './index';
import { createInjection, type Injection } from './injection';
import { report, setLocation } from './pipeline';
import { listenToKeys } from './shortcuts';
import { activateSkin, preloadSkin } from './style';

type Sources = { entity: Entity; navigation: Navigation };
/** The query of one of Root's reads (`user`, `acl`, `flags`), which the components that read it share. */
type Read = ReturnType<DataLayer['component']>;
type Framework = {
  acl: null | Read;
  data: DataLayer;
  flags: null | Read;
  injection: Injection;
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
   * The query client the framework's data lives in, made with `createQueryClient()`. The app makes
   * it and keeps it for its life, so a page's reads stay cached when the page goes and comes back.
   */
  client: QueryClient;
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
   * Change it in a transition so a suspended component does not expose a mixed page.
   */
  locale?: string;
  /**
   * Where the app is, as its router says (`/products/12?status=low`). Failures and
   * interactions carry it. Leave it out when the address's hash holds the route.
   */
  location?: string;
  /** How components move between routes: the address's own navigation, unless another is given. */
  navigation?: Navigation;
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
  client,
  entity = NONE,
  env = NONE,
  flags,
  locale = SOURCE_LOCALE,
  location,
  navigation = NONE,
  skin = 'default',
  sync,
  user,
}: RootProps) {
  use(preloadSkin(skin));
  const content = useMemo(() => boundEach(children), [children]);
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
  // Its reads and writes count as pending for `whenIdle()` while this Root uses it.
  useEffect(() => watch(client), [client]);
  const data = useMemo(() => createDataLayer(client, live as { readonly id: string }), [client, live]);
  const injection = useMemo(() => createInjection(env, live, data), [env, live, data]);
  // The other tabs of the app, through one channel per client.
  useEffect(() => (sync ? data.share(sync) : undefined), [data, sync]);
  // After the commit and before the paint, so a render React throws away changes nothing. The
  // sheets added before it are set again here, before anyone sees them.
  useLayoutEffect(() => activateSkin(skin), [skin]);
  const sources = useMemo(() => ({ entity: selected, navigation }), [selected, navigation]);
  useCommitted(location ?? locale);
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
  const framework = useMemo(
    () => ({
      acl: aclRead,
      data,
      flags: flagsRead,
      injection,
      sources,
      user: userRead,
    }),
    [injection, sources, data, userRead, aclRead, flagsRead],
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

  return (
    <QueryClientProvider client={client}>
      <FrameworkContext value={framework}>
        <LocaleContext value={locale}>
          <Suspense fallback={<Pending />}>{content}</Suspense>
        </LocaleContext>
      </FrameworkContext>
    </QueryClientProvider>
  );
}
