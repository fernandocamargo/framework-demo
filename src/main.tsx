// The app's shell: everything outside the framework's root folders. It decides which world the
// app sees, stands in for a router, hands `Root` what the framework injects, and shows what the
// failure pipeline carries. The app itself starts at components/app.
import { StrictMode, use, useEffect, useMemo, useState, useTransition } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, I18nProvider, Text, UNSTABLE_Toast as Toast, UNSTABLE_ToastContent as ToastContent, UNSTABLE_ToastQueue as ToastQueue, UNSTABLE_ToastRegion as ToastRegion } from 'react-aria-components'
import { chartAt, createQueryClient, onFailure, Pinned, Root, type Acl, type Env, type Injection, type Navigation, type User } from 'framework'
import { go, parse } from './address'
import { currentLocale, type Locale } from './locales'
import App from './components/app'
import States from './components/states'
import './base.css'

// `?world=memory` (or a build with VITE_WORLD=memory) swaps the API client for one that answers
// from fixtures. Nothing else changes: the same services, flows and components run on it.
const world: Env['world'] = new URLSearchParams(window.location.search).get('world') === 'memory' || import.meta.env['VITE_WORLD'] === 'memory' ? 'memory' : 'dummyjson'
const env: Env = { world, apiUrl: 'https://dummyjson.com' }
const entity = { id: world }
const navigation: Navigation = { go }
// One cache for the app's life, so a page's reads survive a dialog opening over it.
const client = createQueryClient()
// Who is signed in: the session the API client holds, then the profile it names, which carries
// the role. Both are reads of the auth service, so a sign-in or a sign-out reads this again, and
// only the components whose files read `user` render again.
const whoIsSignedIn = async ({ services }: Injection): Promise<User | null> => ((await services.auth.session()) ? services.auth.profile() : null)
// What the backend says may be done. The app does not own it: the framework carries it to every
// component that reads `acl`, and each tests its own rules against it.
const permissions = ({ services }: Injection): Promise<Acl> => services.auth.permissions()

// Every failure any layer catches arrives here once, tagged with the layer and what was running.
type Notice = { title: string; description: string }
const toasts = new ToastQueue<Notice>({ maxVisibleToasts: 3 })
onFailure((failure) =>
  toasts.add(
    { title: [failure.layer, failure.path, failure.during].filter(Boolean).join(' · '), description: failure.error.message },
    { timeout: 8000 },
  ),
)

// The address changes inside a transition: a page whose read is keyed by the address keeps
// showing until the new read arrives, instead of falling back to its placeholder.
function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  const [navigating, startNavigation] = useTransition()
  useEffect(() => {
    const follow = () => startNavigation(() => setHash(window.location.hash))
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])
  return [useMemo(() => parse(hash), [hash]), navigating, hash] as const
}

// The states gallery: `#/states` lists every chart; `#/states/<path>/<state>` is one frame of it,
// the component alone, held in that state.
const STATES = '#/states'
function pageOf(hash: string): { gallery: true } | { path: string; state: string } | null {
  if (hash !== STATES && !hash.startsWith(`${STATES}/`)) return null
  const [path, state] = hash.slice(STATES.length + 1).split('/')
  return path && state ? { path: decodeURIComponent(path), state } : { gallery: true }
}

// One load per chart, kept: a component that suspends before its first commit keeps no state, so
// a promise made in its render would be a new one each time it tries again.
const loading = new Map<string, ReturnType<typeof chartAt>>()
const loadChart = (path: string) => {
  let found = loading.get(path)
  if (!found) loading.set(path, (found = chartAt(path)))
  return found
}

/** One frame of the gallery: the component at `path`, held in `state`, with its example. */
function Frame({ path, state }: { path: string; state: string }) {
  const found = use(loadChart(path))
  if (!found) return <p>No chart at {path}.</p>
  const example = found.examples[state]
  const Component = found.component
  return (
    <Pinned path={path} state={state} example={example}>
      <Component {...example?.props} />
    </Pinned>
  )
}

// The locale is part of the address too (`?lang=pt-BR`, src/locales.ts). A change shows in a
// transition: the page keeps the old locale on screen until every component on it has its new
// messages, then shows the new one at once. react-aria formats its own fields (a price field, a
// percentage) in the same locale.
function useLocale() {
  const [locale, setLocale] = useState<Locale>(currentLocale)
  const [, startSwitch] = useTransition()
  useEffect(() => {
    const follow = () => startSwitch(() => setLocale(currentLocale()))
    window.addEventListener('localechange', follow)
    window.addEventListener('popstate', follow)
    return () => {
      window.removeEventListener('localechange', follow)
      window.removeEventListener('popstate', follow)
    }
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return locale
}

function Shell() {
  const [route, navigating, hash] = useRoute()
  const locale = useLocale()
  const page = pageOf(hash)
  return (
    <I18nProvider locale={locale}>
      <Root env={env} entity={entity} route={route} navigation={navigation} client={client} locale={locale} user={whoIsSignedIn} acl={permissions} sync={`stockroom:${world}`}>
        {page === null ? <App navigating={navigating} /> : 'gallery' in page ? <States /> : <Frame key={`${page.path}/${page.state}`} path={page.path} state={page.state} />}
      </Root>
      <ToastRegion queue={toasts} aria-label="Failures">
        {({ toast }) => (
          <Toast toast={toast}>
            <ToastContent>
              <Text slot="title">{toast.content.title}</Text>
              <Text slot="description">{toast.content.description}</Text>
            </ToastContent>
            <Button slot="close" aria-label="Dismiss">
              <span className="icon" data-icon="close" />
            </Button>
          </Toast>
        )}
      </ToastRegion>
    </I18nProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)
