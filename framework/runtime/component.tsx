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
import { createContext, createElement, memo, Suspense, use, useCallback, useLayoutEffect, useMemo, useRef, type ComponentType, type ReactNode } from 'react'
import { useQueryErrorResetBoundary, useSuspenseQueries, useSuspenseQuery, type QueryObserverResult } from '@tanstack/react-query'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { Pending, hold } from './activity'
import { execute, useOperations, type AsyncModule } from './async'
import { recording, recordingRoute, shareByIdentity } from './data'
import { sameParts, tracking, untracked } from './reads'
import { useFormLayer, type FormModule } from './form'
import { activeLocale, intlFor, LocaleContext, loadMessages, showing, SOURCE_LOCALE } from './i18n'
import type { Allowed, Flags } from './index'
import { useStateLayer, type StateModule } from './machine'
import { PinContext } from './pin'
import { shortcutsOf, useKeyboard, useShortcuts, type Entry, type ShortcutSites } from './shortcuts'
import { report, toError, type Scope } from './pipeline'
import { RouteContext, useFramework } from './root'
import { activeSkin, loadSkin, type SkinModule } from './style'
import { tracked } from './thenable'
import { chainOf, commitHandlers, withScope } from './track'
import { shareElements } from './elements'

type Props = Record<string, unknown> & { className?: string }

type ViewModule = {
  render: (props: Props) => ReactNode
  /** `props.ts`: what the render would get, shaped into what it gets. */
  props: { default?: unknown } | undefined
  async: AsyncModule | undefined
  state: StateModule | undefined
  form: FormModule | undefined
  /** `acl.ts`: whether what the component offers may be done. */
  acl?: { default?: unknown } | undefined
  /** `shortcuts.ts`: the keys the component answers while it is on screen. */
  shortcuts?: { default?: unknown } | undefined
  /** Where each key is declared in `shortcuts.ts`, from the plugin, for the interactions it runs. */
  shortcutSites?: ShortcutSites
  /** The components the render shows, from the plugin: their loads start when this view has loaded. */
  children?: readonly { preload?: () => void }[]
}

export type Spec = {
  /** The folder's path from the framework's root, such as `components/app`: the class name. */
  path: string
  view: () => Promise<ViewModule>
  skins: Record<string, () => Promise<SkinModule>>
  placeholder?: ComponentType<Props>
  error?: ComponentType<Props & { error: Error; resetErrorBoundary: () => void }>
  /** `i18n.ts`: the folder's messages, in the source language. */
  i18n?: { default?: unknown }
  /** Each translation of the messages, `i18n/<locale>.json`, loaded on demand. */
  translations?: Record<string, () => Promise<{ default: Record<string, string> }>>
  /**
   * The sources the folder's files read (`intl`, `locale`, `i18n`, `user`, `acl`, `flags`,
   * `route`, `keyboard`), from what their functions destructure: in the view's files (`props.ts`, the render),
   * in `acl.ts` (every name it destructures), in `async.ts`, in `state.ts`, and in the chart's
   * declaration alone. Only what the view reads makes the component render again when it
   * changes; what `async.ts` reads keys its default read; what the declaration reads, declares the
   * chart again.
   */
  reads?: { view?: readonly string[]; acl?: readonly string[]; async?: readonly string[]; state?: readonly string[]; chart?: readonly string[] }
}

/** What the nearest `acl.ts` above decided. With none, everything is allowed. */
export const AclContext = createContext<boolean>(true)
AclContext.displayName = 'Acl'

const NO_SNAPSHOT = Object.freeze({})
const NO_FLAGS = Object.freeze({}) as Flags

/**
 * A value as a component last rendered it. A new one stands for a change in a part the component
 * read; the same one, for none. It is not a plain object, so TanStack compares it by identity.
 */
class Seen {
  constructor(readonly value: unknown) {}
}
/** The same `Seen` while the parts under `keys` stay as they were, a new one when one changes. */
const seenOf = (last: Seen | null, value: unknown, keys: ReadonlySet<string>) => (last && sameParts(last.value, value, keys) ? last : new Seen(value))
/** Each snapshot with each decision on it, one object per pair, so it keeps its identity. */
const decisions = new WeakMap<object, [Allowed?, Allowed?]>()

/** The backend's snapshot with a decision on it: what a component gets as `acl`. */
function allowedOn(snapshot: unknown, allowed: boolean): Allowed {
  const base = (snapshot && typeof snapshot === 'object' ? snapshot : NO_SNAPSHOT) as object
  let pair = decisions.get(base)
  if (!pair) decisions.set(base, (pair = []))
  const at = allowed ? 1 : 0
  return (pair[at] ??= Object.freeze({ ...base, allowed }) as Allowed)
}

/** The keys of the snapshot a component read; `allowed` is the decision's, not the snapshot's. */
const ofSnapshot = (keys: ReadonlySet<string>) => new Set([...keys].filter((key) => key !== 'allowed'))

const ScopeContext = createContext<Scope | null>(null)
ScopeContext.displayName = 'Scope'

/** The path first, then any class the parent passes. */
const classes = (path: string, className: unknown) => (typeof className === 'string' && className ? `${path} ${className}` : path)

const NO_LAYER = {}

/** Only the values a component reads, so spreading them over the props adds nothing else. */
const defined = (values: object) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Record<string, unknown>

const sameEach = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]))

/** The props are the same when they have the same keys with the same values, as `memo` compares them. */
const sameProps = (a: Props, b: Props) => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]))
}

export function component(spec: Spec) {
  const inView = new Set(spec.reads?.view ?? [])
  const inAcl = new Set(spec.reads?.acl ?? [])
  const inAsync = new Set(spec.reads?.async ?? [])
  const inState = new Set(spec.reads?.state ?? [])
  const inChart = new Set(spec.reads?.chart ?? [])
  const anywhere = (source: string) => [inView, inAcl, inAsync, inState, inChart].some((reads) => reads.has(source))
  // What the component follows, fixed for its life, so each context is read on every render or
  // on none: the locale, when it has messages or reads the locale; the user and the backend's
  // snapshot, when any of its files reads them.
  const followsLocale = Boolean(spec.i18n) || ['intl', 'locale', 'i18n'].some((source) => inView.has(source) || inAsync.has(source) || inChart.has(source))
  const keyedByLocale = inAsync.has('intl') || inAsync.has('locale')
  const readsUser = anywhere('user')
  const keyedByUser = inAsync.has('user')
  const readsAcl = anywhere('acl')
  const keyedByAcl = inAsync.has('acl')
  const readsFlags = anywhere('flags')
  const keyedByFlags = inAsync.has('flags')
  const viewReadsRoute = inView.has('route') || inAcl.has('route')
  // The keys on screen, for a component that lists them.
  const readsKeyboard = inView.has('keyboard')
  // An acl.ts that reads only `acl` (the snapshot, and what is inherited) and `flags` is a rule of
  // the folder, the same for every instance: it is decided where the snapshot and the flags are
  // read, and an instance renders again only when its decision changes, not every time the snapshot
  // or a flag does (a sign-in re-decides a delete link in every row, and renders none whose answer
  // stays the same).
  const folderRule = inAcl.size > 0 && [...inAcl].every((name) => name === 'acl' || name === 'flags')
  // A rule that reads the chart's state is decided after the chart; any other, before it, so the
  // chart's declaration and its guards see this render's decision.
  const ruleReadsState = inAcl.has('state') || inAcl.has('*')
  let view: Promise<ViewModule> | undefined
  // Once the view has loaded, the components it shows start loading theirs, so a child does not
  // wait to render before its own view starts, and React does not render its parent again when
  // that view arrives.
  const loadView = () =>
    (view ??= tracked(
      hold(
        spec.view().then((module) => {
          for (const child of module.children ?? []) child.preload?.()
          return module
        }),
      ),
    ))
  /** Starts loading the view, the page's skin and the messages, ahead of the first render. */
  const preload = () => {
    void loadView()
    if (spec.i18n) void loadMessages(spec, activeLocale())
    const skin = activeSkin()
    const loadThisSkin = spec.skins[skin]
    if (loadThisSkin) void loadSkin(spec.path, skin, loadThisSkin)
  }

  /**
   * The locale, the folder's messages in it and react-intl's `intl`, for a component that reads
   * them. The messages may still be loading: the component waits for them, as for its view.
   */
  function useLanguage() {
    const locale = followsLocale ? use(LocaleContext) : SOURCE_LOCALE
    const messages = spec.i18n ? use(loadMessages(spec, locale)) : undefined
    // While on screen, a change of locale loads this folder's messages before it shows.
    useLayoutEffect(() => (spec.i18n ? showing(spec) : undefined), [])
    return useMemo(
      () => ({ locale: followsLocale ? locale : undefined, i18n: messages, intl: followsLocale ? intlFor(locale) : undefined }),
      [locale, messages],
    )
  }

  /** Every layer of the view but the state layer, called in the same order on every render. */
  function useLayers() {
    const { injection, skin, sources, data, user: userRead, acl: aclRead, flags: flagsRead } = useFramework()
    const language = useLanguage()
    // The person signed in, from Root's `user` read: a sign-in or a sign-out makes it stale, and
    // only the components that read it render again.
    const user = readsUser ? (userRead ? (useSuspenseQuery(userRead).data as unknown) : null) : undefined
    const module = use(loadView())
    const inherited = readsAcl || module.acl ? use(AclContext) : true
    // The parts of the backend's snapshot and of the flags this component's files read, recorded as
    // they read them (reads.ts). The component follows those parts, and its folder rule's decision:
    // one subscription to both reads, which renders it again only when what `combine` returns
    // changes. Each part is compared with what this component last rendered, so the keys a render
    // first reads count from the first change on.
    const keys = useRef(new Set<string>()).current
    const flagKeys = useRef(new Set<string>()).current
    const views = useRef(new WeakMap<object, Allowed>()).current
    const flagViews = useRef(new WeakMap<object, Flags>()).current
    const view = useCallback(
      (acl: Allowed) => {
        let tracked = views.get(acl)
        if (!tracked) views.set(acl, (tracked = tracking(acl, keys)))
        return tracked
      },
      [views, keys],
    )
    const flagsView = useCallback(
      (flags: Flags) => {
        let tracked = flagViews.get(flags)
        if (!tracked) flagViews.set(flags, (tracked = tracking(flags, flagKeys)))
        return tracked
      },
      [flagViews, flagKeys],
    )
    const rule = folderRule ? module.acl?.default : undefined
    // Which of Root's reads this component subscribes to, in a fixed order: whether it reads each is
    // fixed once its view has loaded, and whether Root has each, for Root's life.
    const aclAt = readsAcl && aclRead ? 0 : -1
    const flagsAt = readsFlags && flagsRead ? aclAt + 1 : -1
    const seen = useRef<{ acl: Seen | null; flags: Seen | null }>({ acl: null, flags: null }).current
    const combine = useCallback(
      (results: readonly Pick<QueryObserverResult, 'data'>[]) => {
        const snapshot = aclAt < 0 ? NO_SNAPSHOT : results[aclAt]?.data
        const flags = (flagsAt < 0 ? NO_FLAGS : results[flagsAt]?.data) as Flags
        return {
          parts: readsAcl ? seenOf(seen.acl, snapshot, ofSnapshot(keys)) : undefined,
          flags: readsFlags ? seenOf(seen.flags, flags, flagKeys) : undefined,
          decided: rule ? decide(rule, { acl: allowedOn(snapshot, inherited), flags }) : undefined,
        }
      },
      [rule, inherited, keys, flagKeys, aclAt, flagsAt, seen],
    )
    const subscribed = [...(aclAt < 0 ? [] : [aclRead!]), ...(flagsAt < 0 ? [] : [flagsRead!])]
    const followed = readsAcl || readsFlags ? (subscribed.length ? useSuspenseQueries({ queries: subscribed, combine }) : combine([])) : undefined
    // What this render shows: a later change is compared with it.
    if (followed) {
      seen.acl = followed.parts ?? null
      seen.flags = followed.flags ?? null
    }
    const latest = useCallback(() => (aclRead ? data.client.getQueryData(aclRead.queryKey) : NO_SNAPSHOT), [aclRead, data])
    const latestFlags = useCallback(() => ((flagsRead ? data.client.getQueryData(flagsRead.queryKey) : undefined) ?? NO_FLAGS) as Flags, [flagsRead, data])
    const snapshot = readsAcl ? latest() : undefined
    const flagged = readsFlags ? latestFlags() : undefined
    const route = viewReadsRoute ? use(RouteContext) : undefined
    const keyboard = readsKeyboard ? useKeyboard() : undefined
    // What the chart's guards and the operations read when they run: the latest decision, set by
    // each render.
    const judged = useRef<boolean>(inherited)
    const loadThisSkin = spec.skins[skin]
    if (loadThisSkin) use(loadSkin(spec.path, skin, loadThisSkin))

    const parent = use(ScopeContext)
    const scope = useMemo(() => ({ path: spec.path, parent }), [parent])
    const { locale } = language
    const injected = useMemo(() => {
      const all: Record<string, unknown> = { ...injection, ...sources, ...defined(language), ...defined({ user }) }
      // Getters: the chart's guards and the operations spread these when they run, and get the
      // snapshot, the decision and the flags of that moment.
      if (readsAcl) Object.defineProperty(all, 'acl', { get: () => view(allowedOn(latest(), judged.current)), enumerable: true })
      if (readsFlags) Object.defineProperty(all, 'flags', { get: () => flagsView(latestFlags()), enumerable: true })
      return all
    }, [injection, sources, language, user, view, latest, flagsView, latestFlags])

    // The default export of async.ts, as a query: it records the services and route parameters
    // it reads, so the data layer knows when to run it again. It gets the query's signal, which
    // aborts when nothing shows the read any more, as the named exports get theirs on unmount.
    // Only a component with a default read reads the route, so a change of route re-renders it and
    // no other. `use` may read a context behind a condition, and the condition is fixed
    // for any one component once its view has loaded.
    const exported = module.async?.default
    const readRoute = (typeof exported === 'function' ? use(RouteContext) : null) as Record<string, unknown> | null
    const userId = (user as { id?: unknown } | null | undefined)?.id ?? null
    const query = useMemo(
      () =>
        typeof exported !== 'function' || readRoute === null
          ? null
          : data.component(
              spec.path,
              readRoute,
              (record, signal) =>
                execute(exported, { ...injected, signal, services: recording(injection.services, record.service, record.peek), route: recordingRoute(readRoute, record.route) }, []),
              keyedByLocale || keyedByUser || keyedByAcl || keyedByFlags
                ? defined({ locale: keyedByLocale ? locale : undefined, user: keyedByUser ? userId : undefined, acl: keyedByAcl ? snapshot : undefined, flags: keyedByFlags ? flagged : undefined })
                : undefined,
            ),
      [data, exported, injection, injected, readRoute, locale, userId, snapshot, flagged],
    )
    // A view with no default read has no query. A stand-in query would suspend the first instance
    // of each such component once, and React would render everything inside the boundary again
    // for each one, a level deeper each time. Whether the view has a default read is
    // fixed once it has loaded, so any one component makes this call on every render or on none.
    const answer: unknown = query ? useSuspenseQuery(query).data : undefined
    // An answer keeps every part equal to the last answer this component showed, under any key,
    // so a child given an equal part gets the same object and its memo holds.
    const shown = useRef<unknown>(undefined)
    const initial = useMemo(() => (shown.current === undefined ? answer : shareByIdentity(shown.current, answer)), [answer])
    useLayoutEffect(() => {
      shown.current = initial
    }, [initial])

    // A component held in one state in the states gallery starts its form with the example's values.
    const pin = use(PinContext)
    // The render follows the values it reads; the chart and the operations read the latest when they run.
    const { view: form, latest: running } = useFormLayer((module.form ?? NO_LAYER) as FormModule, pin?.path === spec.path ? pin.example?.values : undefined)
    const withForm = useMemo(() => (module.form ? { ...injected, form: running } : injected), [injected, running, module.form])
    const operations = useOperations(spec.path, module.async, withForm)
    const hasRead = query !== null
    const async = useMemo(() => module.async && { ...operations, ...(hasRead ? { default: initial } : {}) }, [module.async, operations, hasRead, initial])
    const flags = flagged && flagsView(flagged)
    const access = useMemo(
      () => ({ given: defined({ user, flags, route, keyboard }), user, flags, flagged, inherited, decided: followed?.decided, snapshot, view }),
      [user, flags, flagged, route, keyboard, inherited, followed, snapshot, view],
    )
    return { module, scope, injection, sources, withForm, form, async, language, access, judged }
  }

  /** Runs a rule. A rule that throws refuses, and is reported as the acl layer's failure. */
  function decide(rule: unknown, given: Props): boolean {
    try {
      return Boolean((rule as (given: Props) => unknown)(given))
    } catch (thrown) {
      report(thrown, { layer: 'acl', path: spec.path })
      return false
    }
  }

  /** What a render, props.ts and acl.ts get from the props and the layers. */
  function givenOf(props: Props, layers: ReturnType<typeof useLayers>, state: unknown, className: string): Props {
    const { module, form, async, language, access } = layers
    return { ...props, className, ...(async ? { async } : {}), ...(state ? { state } : {}), ...(module.form ? { form } : {}), ...defined(language), ...access.given }
  }

  /**
   * This instance's decision: its folder rule's, already decided where the snapshot is read; its
   * own acl.ts's, from what props.ts would get, the route and the snapshot with what is inherited
   * on it; or what it inherits.
   */
  function decisionOf(module: ViewModule, given: Props, access: ReturnType<typeof useLayers>['access']): boolean {
    if (access.decided !== undefined) return access.decided
    const rule = module.acl?.default
    if (typeof rule !== 'function') return access.inherited
    return decide(rule, { ...given, acl: access.view(allowedOn(access.snapshot, access.inherited)) })
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
  function show(props: Props, layers: ReturnType<typeof useLayers>, state: unknown, decided?: boolean) {
    const { module, scope, form, async, language, access, judged } = layers
    const last = useRef<{ inputs: unknown[]; props: Props; shaped: Props; allowed: boolean; rendered: ReactNode; element: ReactNode } | null>(null)
    // The handlers of the render React committed are the ones the instance's wrappers call.
    useLayoutEffect(() => commitHandlers(scope))
    // The keys this instance answers, registered after each commit while it is mounted.
    const keys = useRef<Entry[] | undefined>(undefined)
    useShortcuts(spec.path, scope, keys)
    const inputs = [module, scope, async, state, form, language, access, decided]
    if (last.current && sameEach(last.current.inputs, inputs) && sameProps(last.current.props, props)) return last.current.element
    const className = classes(spec.path, props.className)
    const given = givenOf(props, layers, state, className)
    const allowed = decided ?? decisionOf(module, given, access)
    judged.current = allowed
    const shaping = readsAcl ? { ...given, acl: access.view(allowedOn(access.snapshot, allowed)) } : given
    // shortcuts.ts gets what props.ts gets. Its keys follow the state even when the render is skipped.
    if (module.shortcuts) keys.current = shortcutsOf(spec.path, module.shortcuts, shaping, state as never, scope, module.shortcutSites)
    const output = shape(module, shaping, className)
    // The framework's own comparison reads every key; it records none.
    const shaped = untracked(() => shareByIdentity(last.current?.shaped, output)) as Props
    if (last.current && shaped === last.current.shaped && allowed === last.current.allowed) {
      last.current = { ...last.current, inputs, props }
      return last.current.element
    }
    // What did not change since the last output is the element React showed then, and it skips it.
    const rendered = shareElements(last.current?.rendered, withScope(scope, () => module.render(shaped))) as ReactNode
    // What this folder's acl.ts decided reaches every component below, until one of them decides otherwise.
    const element = createElement(ScopeContext, { value: scope }, module.acl ? createElement(AclContext, { value: allowed }, rendered) : rendered)
    last.current = { inputs, props, shaped, allowed, rendered, element }
    return element
  }

  /** What `props.ts` returns, with the `className`; a failure there is reported as the props layer's. */
  function shape(module: ViewModule, given: Props, className: string): Props {
    const shaping = module.props?.default
    if (typeof shaping !== 'function') return given
    try {
      return { className, ...(shaping as (props: Props) => Props)(given) }
    } catch (thrown) {
      throw report(thrown, { layer: 'props', path: spec.path })
    }
  }

  /** The route being rendered. `use` may be called behind a condition, during a render. */
  const readRendering = () => use(RouteContext)

  // A folder with a state.ts and one without render through different components, so neither
  // calls a hook behind a condition. The view's module, once loaded, decides which.
  function StatefulView(props: Props) {
    const layers = useLayers()
    const { module, access, judged, language } = layers
    // The decision comes before the chart, so its declaration and its guards see this render's.
    // A rule that reads the chart's state is decided after it, in show.
    const early = ruleReadsState ? undefined : decisionOf(module, givenOf(props, layers, undefined, classes(spec.path, props.className)), access)
    if (early !== undefined) judged.current = early
    // What the declaration may read, besides the injection: the chart is declared again when a
    // part it read changes, and keeps its place (machine.ts).
    const declared = defined({
      acl: readsAcl ? access.view(allowedOn(access.snapshot, judged.current)) : undefined,
      user: access.user,
      flags: access.flags,
      ...language,
    })
    // The route being rendered, for the chart's first reads (machine.ts), read only until the
    // component's first commit: after it, a change of route does not render the component again.
    // The sources state.ts reads, each told to the chart by an event of its name when it changes.
    const told = defined({
      user: inState.has('user') ? access.user : undefined,
      acl: inState.has('acl') ? access.snapshot : undefined,
      flags: inState.has('flags') ? access.flagged : undefined,
      locale: inState.has('locale') ? language.locale : undefined,
    })
    const state = useStateLayer(spec.path, module.state as StateModule, layers.injection, declared, layers.withForm, readRendering, told)
    return show(props, layers, state, early)
  }
  function StatelessView(props: Props) {
    return show(props, useLayers(), undefined)
  }
  StatefulView.displayName = spec.path
  StatelessView.displayName = spec.path

  function View(props: Props) {
    return createElement(use(loadView()).state ? StatefulView : StatelessView, props)
  }
  View.displayName = spec.path

  const { placeholder: Placeholder, error: ErrorFallback } = spec

  // The placeholder and the error file show the folder's messages too, so the component's
  // wrapper reads them when the folder has both.
  const fallbacksSpeak = Boolean(spec.i18n) && Boolean(spec.placeholder || spec.error)

  function Component(props: Props) {
    const className = classes(spec.path, props.className)
    const { reset } = useQueryErrorResetBoundary()
    const parent = use(ScopeContext)
    const language = fallbacksSpeak ? defined(useLanguage()) : null
    let tree: ReactNode = createElement(View, props)
    if (Placeholder) tree = createElement(Suspense, { fallback: createElement(Pending, null, createElement(Placeholder, { ...props, className, ...language })) }, tree)
    if (ErrorFallback) {
      tree = createElement(ErrorBoundary, {
        // The fallback gets an `Error` whatever was thrown, and a reset that takes no arguments.
        fallbackRender: (fallback: FallbackProps) =>
          createElement(ErrorFallback, { ...props, className, ...language, error: toError(fallback.error), resetErrorBoundary: () => fallback.resetErrorBoundary() }),
        onError: (error: unknown) => report(error, { layer: 'render', path: spec.path, chain: [...chainOf(parent), spec.path] }),
        onReset: reset,
        children: tree,
      })
    }
    return tree
  }
  Component.displayName = `${spec.path} (wrapper)`

  // A render is a pure function of what props.ts works out from the props and the layers, so a
  // parent's re-render that passes the same props (shallowly) changes nothing here. The layers'
  // own changes (state, operations, data, the framework's context) still re-render it.
  return Object.assign(memo(Component), { preload })
}
