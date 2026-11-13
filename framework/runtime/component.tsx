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
 */
import { createContext, createElement, memo, Suspense, use, useLayoutEffect, useMemo, useRef, type ComponentType, type ReactNode } from 'react'
import { useQueryErrorResetBoundary, useSuspenseQuery } from '@tanstack/react-query'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { Pending, hold } from './activity'
import { execute, useOperations, type AsyncModule } from './async'
import { recording, recordingRoute, shareByIdentity } from './data'
import { useFormLayer, type FormModule } from './form'
import { activeLocale, intlFor, LocaleContext, loadMessages, showing, SOURCE_LOCALE } from './i18n'
import { useStateLayer, type StateModule } from './machine'
import { report, toError, type Scope } from './pipeline'
import { RouteContext, useFramework } from './root'
import { activeSkin, loadSkin, type SkinModule } from './style'
import { tracked } from './thenable'
import { chainOf, withScope } from './track'

type Props = Record<string, unknown> & { className?: string }

type ViewModule = {
  render: (props: Props) => ReactNode
  /** `props.ts`: what the render would get, shaped into what it gets. */
  props: { default?: unknown } | undefined
  async: AsyncModule | undefined
  state: StateModule | undefined
  form: FormModule | undefined
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
   * The sources the folder's files read (`intl`, `locale`, `user`, `acl`, `flags`), from what
   * their functions destructure. Only those make the component render again when they change.
   */
  reads?: readonly string[]
  /** Those of them `async.ts` reads: its default read is keyed by their values too. */
  readsInAsync?: readonly string[]
}

const ScopeContext = createContext<Scope | null>(null)

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
  const reads = new Set(spec.reads ?? [])
  // Whether the component follows the locale: its messages, or `intl` or `locale` read anywhere.
  // Fixed for the component's life, so the context is read on every render or on none.
  const followsLocale = Boolean(spec.i18n) || reads.has('intl') || reads.has('locale')
  const keyedByLocale = (spec.readsInAsync ?? []).some((source) => source === 'intl' || source === 'locale')
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
    const { injection, skin, sources, data } = useFramework()
    const language = useLanguage()
    const module = use(loadView())
    const loadThisSkin = spec.skins[skin]
    if (loadThisSkin) use(loadSkin(spec.path, skin, loadThisSkin))

    const parent = use(ScopeContext)
    const scope = useMemo(() => ({ path: spec.path, parent }), [parent])
    const { locale } = language
    const injected = useMemo(() => ({ ...injection, ...sources, ...defined(language) }), [injection, sources, language])

    // The default export of async.ts, as a query: it records the services and route parameters
    // it reads, so the data layer knows when to run it again. It gets the query's signal, which
    // aborts when nothing shows the read any more, as the named exports get theirs on unmount.
    // Only a component with a default read reads the route, so a change of route re-renders it and
    // no other. `use` may read a context behind a condition, and the condition is fixed
    // for any one component once its view has loaded.
    const exported = module.async?.default
    const route = (typeof exported === 'function' ? use(RouteContext) : null) as Record<string, unknown> | null
    const query = useMemo(
      () =>
        typeof exported !== 'function' || route === null
          ? null
          : data.component(
              spec.path,
              route,
              (record, signal) =>
                execute(exported, { ...injected, signal, services: recording(injection.services, record.service), route: recordingRoute(route, record.route) }, []),
              keyedByLocale ? { locale } : undefined,
            ),
      [data, exported, injection, injected, route, locale],
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

    const form = useFormLayer((module.form ?? NO_LAYER) as FormModule)
    const withForm = useMemo(() => (module.form ? { ...injected, form } : injected), [injected, form, module.form])
    const operations = useOperations(spec.path, module.async, withForm)
    const hasRead = query !== null
    const async = useMemo(() => module.async && { ...operations, ...(hasRead ? { default: initial } : {}) }, [module.async, operations, hasRead, initial])
    return { module, scope, injection, withForm, form, async, language }
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
  function show(props: Props, layers: ReturnType<typeof useLayers>, state: unknown) {
    const { module, scope, form, async, language } = layers
    const last = useRef<{ inputs: unknown[]; props: Props; shaped: Props; element: ReactNode } | null>(null)
    const inputs = [module, scope, async, state, form, language]
    if (last.current && sameEach(last.current.inputs, inputs) && sameProps(last.current.props, props)) return last.current.element
    const className = classes(spec.path, props.className)
    const given: Props = { ...props, className, ...(async ? { async } : {}), ...(state ? { state } : {}), ...(module.form ? { form } : {}), ...defined(language) }
    const shaped = shareByIdentity(last.current?.shaped, shape(module, given, className)) as Props
    if (last.current && shaped === last.current.shaped) {
      last.current = { ...last.current, inputs, props }
      return last.current.element
    }
    const element = createElement(ScopeContext, { value: scope }, withScope(scope, () => module.render(shaped)))
    last.current = { inputs, props, shaped, element }
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

  // A folder with a state.ts and one without render through different components, so neither
  // calls a hook behind a condition. The view's module, once loaded, decides which.
  function StatefulView(props: Props) {
    const layers = useLayers()
    // The route being rendered, for the chart's first reads (machine.ts). So a component with a
    // state.ts renders its layers again when the route changes; its render is still skipped
    // when what it shows is the same.
    const state = useStateLayer(spec.path, layers.module.state as StateModule, layers.injection, layers.withForm, use(RouteContext))
    return show(props, layers, state)
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
