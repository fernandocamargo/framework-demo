/**
 * `Root`: composes what the framework provides: the injection, the data layer (one
 * TanStack Query client), the sources the state and async layers read (`entity`, `route`,
 * `navigation`), the reads every layer may follow (`user`, `acl`, `flags`), the page's skin, and the app's global error listeners, the
 * last resort of the error pipeline. A `Suspense` at the top catches components with no
 * placeholder.
 */
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { createContext, Suspense, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { hold, Pending, useCommitted, watch } from './activity'
import { createDataLayer, createQueryClient, recording, type DataLayer } from './data'
import type { Acl, Entity, Env, Flags, Navigation, Route, User } from './index'
import { activateLocale, loadShown, LocaleContext, SOURCE_LOCALE } from './i18n'
import { createInjection, type Injection } from './injection'
import { report, setLocation } from './pipeline'
import { listenToKeys } from './shortcuts'
import { activateSkin } from './style'

type Sources = { entity: Entity; route: Route; navigation: Navigation }
/** The query of one of Root's reads (`user`, `acl`, `flags`), which the components that read it share. */
type Read = ReturnType<DataLayer['component']>
type Framework = { injection: Injection; skin: string; sources: Sources; data: DataLayer; user: Read | null; acl: Read | null; flags: Read | null }

const FrameworkContext = createContext<Framework | null>(null)
FrameworkContext.displayName = 'Framework'

export function useFramework() {
  const framework = useContext(FrameworkContext)
  if (!framework) throw new Error('A framework component rendered outside <Root>')
  return framework
}

// With no keys declared by the app, empty objects are valid.
const NONE = {} as never

/**
 * The route as the render sees it. Only a component whose default read can depend on the route
 * reads this context, so a change of route re-renders those and no other.
 */
export const RouteContext = createContext<Route>(NONE)
RouteContext.displayName = 'Route'

/** A view of `ref.current` as if it were the object itself: reading, `in`, keys and spreading. */
function liveView<T extends object>(ref: { readonly current: T }): T {
  return new Proxy({} as T, {
    get: (_, key) => Reflect.get(ref.current, key),
    has: (_, key) => Reflect.has(ref.current, key),
    ownKeys: () => Reflect.ownKeys(ref.current),
    getOwnPropertyDescriptor: (_, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(ref.current, key)
      return descriptor && { ...descriptor, configurable: true }
    },
  })
}

export type RootProps = {
  /** What clients receive as `env`. Keep the object stable: a new one rebuilds every client. */
  env?: Env
  /** The selected entity. Services read `entity.id` when they run. */
  entity?: Entity
  /** The current route's parameters. A stand-in until the routing layer is designed. */
  route?: Route
  /**
   * The feature flags for the person signed in: a read of the services, given that person as the
   * `user` read names them (`({ services, user }) => services.flags.evaluate(…)`). Every component
   * file and chart declaration that reads `flags` gets them, waits for them the first time, and
   * follows only the flags it reads. It runs through the data layer and reads the person the way
   * the `user` read does, so a sign-in or a sign-out reads it again; a service read that follows
   * its source (`follows` in `meta.ts`) reads it again when a flag changes. Keep the function stable.
   */
  flags?: (injection: Injection & { signal: AbortSignal; user: User | null }) => Promise<Flags>
  /**
   * Who is signed in: a read of the services, such as the session and then the profile it names
   * (`({ services }) => …`), resolving to the person or `null`. Components whose files read
   * `user` get it, and wait for it the first time. It runs through the data layer, so a write that
   * makes one of the services it read stale (a sign-in, a sign-out) reads it again, and only the
   * components that read `user` render again, if the person changed. Keep the function stable.
   */
  user?: (injection: Injection & { signal: AbortSignal }) => Promise<User | null>
  /**
   * What the backend says may be done: a snapshot the app does not own (roles, grants, limits),
   * read from the services (`({ services }) => services.auth.permissions()`). The framework only
   * carries it: every component file and chart declaration that reads `acl` gets it, with
   * `allowed` on it, the decision of the nearest `acl.ts` above, and follows only the parts of it
   * it reads. Like `user`, it runs through the data layer, so a sign-in or a sign-out reads it
   * again. Keep the function stable.
   */
  acl?: (injection: Injection & { signal: AbortSignal }) => Promise<Acl>
  /**
   * The name of the channel the app's tabs share (`stockroom`). With one, a write that succeeds in
   * a tab makes the same reads stale in the others, so they read them again: a save, a sign-in or
   * a sign-out in one tab reaches every tab. Leave it out, and each tab is on its own.
   */
  sync?: string
  /** How components move between routes. A stand-in until the routing layer is designed. */
  navigation?: Navigation
  /** The skin of the whole page. */
  skin?: string
  /**
   * The locale the page shows (`pt-BR`). A component with an `i18n.ts`, or one that reads `intl`
   * or `locale`, follows it, and no other. When it changes, the page keeps the old locale on
   * screen until every component on it has its messages in the new one, then shows it at once.
   */
  locale?: string
  /**
   * Where the app is, as its router says (`/products/12?status=low`). Failures and
   * interactions carry it. Leave it out when the address's hash holds the route.
   */
  location?: string
  /**
   * The query client the framework's data lives in, made with `createQueryClient()`. Give Root one
   * the app keeps for its life, and a page's reads stay cached when the page goes and comes back
   *; leave it out, and Root makes one for its own life.
   */
  client?: QueryClient
  children?: ReactNode
}

export function Root({ env = NONE, entity = NONE, route = NONE, flags, navigation = NONE, skin = 'default', locale = SOURCE_LOCALE, user, acl, sync, location, client: given, children }: RootProps) {
  // Services were created once and read the entity when they run, so the entity they see is live.
  const current = useRef(entity)
  current.current = entity
  const live = useMemo<Entity>(() => new Proxy({} as Entity, { get: (_, key) => Reflect.get(current.current as object, key) }), [])
  // Root makes a client only when the app gives none, once for its life.
  const own = useRef<QueryClient | null>(null)
  const client = given ?? (own.current ??= createQueryClient())
  // Its reads and writes count as pending for `whenIdle()` while this Root uses it.
  useEffect(() => watch(client), [client])
  const data = useMemo(() => createDataLayer(client, live as { readonly id: string }), [client, live])
  const injection = useMemo(() => createInjection(env, live, data), [env, live, data])
  // The other tabs of the app, through one channel per client.
  useEffect(() => (sync ? data.share(sync) : undefined), [data, sync])
  // After the commit and before the paint, so a render React throws away changes nothing. The
  // sheets added before it are set again here, before anyone sees them.
  useLayoutEffect(() => activateSkin(skin), [skin])
  // Operations and state charts read the route when they run: the route on screen, committed. So
  // the sources the framework's context carries stay the same object when the route changes.
  const committedRoute = useRef(route)
  useLayoutEffect(() => {
    committedRoute.current = route
  }, [route])
  const liveRoute = useMemo(() => liveView(committedRoute), [])
  const sources = useMemo(() => ({ entity, route: liveRoute, navigation }), [entity, liveRoute, navigation])
  // A new route counts as pending for `whenIdle()` until React commits it: a navigation in a
  // transition keeps the old page on screen with no placeholder while React renders the new one.
  useCommitted(route)
  // Loads started outside a render (a view preloading its children's) use the locale asked for,
  // so a change of locale starts loading the new messages as early as it can.
  activateLocale(locale)
  // The locale on screen follows the one asked for once the messages of every component on
  // screen are loaded in it: one commit, nothing suspending. React loses a change of context
  // for a component whose sibling suspends in the same update, so the framework never lets a
  // change of locale suspend.
  const [shown, setShown] = useState(locale)
  useEffect(() => {
    if (shown === locale) return
    let current = true
    void hold(loadShown(locale)).then(
      () => current && setShown(locale),
      () => current && setShown(locale),
    )
    return () => {
      current = false
    }
  }, [locale, shown])
  useCommitted(shown)
  const userRead = useMemo(
    () => (user ? data.component('framework/user', {}, (record, signal) => user({ ...injection, signal, services: recording(injection.services, record.service, record.peek) })) : null),
    [data, injection, user],
  )
  const aclRead = useMemo(
    () => (acl ? data.component('framework/acl', {}, (record, signal) => acl({ ...injection, signal, services: recording(injection.services, record.service, record.peek) })) : null),
    [data, injection, acl],
  )
  // The flags are for a person: the read runs the `user` read's function too, through the same
  // recording, so it reads what that one reads (cached), and is read again whenever it is.
  const flagsRead = useMemo(
    () =>
      flags
        ? data.component('framework/flags', {}, async (record, signal) => {
            const services = recording(injection.services, record.service, record.peek)
            const person = user ? await user({ ...injection, signal, services }) : null
            return flags({ ...injection, signal, services, user: person })
          })
        : null,
    [data, injection, user, flags],
  )
  const framework = useMemo(() => ({ injection, skin, sources, data, user: userRead, acl: aclRead, flags: flagsRead }), [injection, skin, sources, data, userRead, aclRead, flagsRead])
  // Root's reads start side by side as Root mounts, not each when the first component that reads it
  // renders: a read first needed deep in the tree (the rows' flags) would suspend it there, and
  // React would render the components around it again.
  useEffect(() => {
    for (const read of [userRead, aclRead, flagsRead]) if (read) void data.client.prefetchQuery(read)
  }, [data, userRead, aclRead, flagsRead])

  // Failures and interactions carry where the app is; setLocation returns what unsets it.
  useEffect(() => (location === undefined ? undefined : setLocation(location)), [location])

  // The keys the components on screen declare in their shortcuts.ts.
  useEffect(() => listenToKeys(), [])

  // What escapes every layer still reaches the pipeline, unidentified.
  useEffect(() => {
    const onError = (event: ErrorEvent) => report(event.error ?? event.message, { layer: 'global' })
    const onRejection = (event: PromiseRejectionEvent) => report(event.reason, { layer: 'global' })
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return (
    <QueryClientProvider client={client}>
      <FrameworkContext value={framework}>
        <RouteContext value={route}>
          <LocaleContext value={shown}>
            <Suspense fallback={<Pending />}>{children}</Suspense>
          </LocaleContext>
        </RouteContext>
      </FrameworkContext>
    </QueryClientProvider>
  )
}
