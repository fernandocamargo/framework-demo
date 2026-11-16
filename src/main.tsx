// The app's shell: everything outside the framework's root folders. It decides which world the
// app sees, hands `Root` what the framework injects, and shows what the
// failure pipeline carries. The app itself starts at components/app.

import { StrictMode, Suspense, use, useCallback, useEffect, useMemo } from 'react';
import {
  Button,
  I18nProvider,
  RouterProvider,
  Text,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from 'react-aria-components';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, UNSAFE_NavigationContext as NavigationContext, useLocation } from 'react-router';
import { useNavigation } from 'virtual:framework/address';

import { bound, chartAt, createQueryClient, type Env, onFailure, Pending, Pinned, Root } from 'framework';

import { useCommitted } from '../framework/runtime/activity';
import { setLocation } from '../framework/runtime/pipeline';
import { codec, EditingProductContext, type Settings, settingsOf, STATES } from './address';
import App from './components/app';
import States from './components/states';
import { fromLegacy } from './legacy';
import { currentLocale, preloadLocale } from './locales';
import { featureFlags, permissions, whoIsSignedIn } from './reads';
import { currentSkin } from './skins';
import './base.css';
import './broadsheet.css';
import './blueprint.css';

// A bookmark from before the routes opens its new address (legacy.ts).
const moved = fromLegacy(window.location);
if (moved !== null) window.history.replaceState(window.history.state, '', moved);

const initial = codec.read(window.location.pathname.slice(codec.base.length - 1), window.location.search);
const world: Env['world'] =
  initial.query['world'] === 'memory' || import.meta.env['VITE_WORLD'] === 'memory' ? 'memory' : 'dummyjson';
// GrowthBook serves the real world's flags when its client key is in the build (.env.local).
const env: Env = {
  apiUrl: 'https://dummyjson.com',
  flagsKey: import.meta.env['VITE_GROWTHBOOK_CLIENT_KEY'],
  mapsKey: import.meta.env['VITE_MAPTILER_KEY'],
  world,
};
const entity = { id: world };
// One cache for the app's life, so a page's reads survive a dialog opening over it.
const client = createQueryClient();

// Every failure any layer catches arrives here once, tagged with the layer and what was running.
type Notice = { description: string; title: string };
const toasts = new ToastQueue<Notice>({ maxVisibleToasts: 3 });
onFailure((failure) =>
  toasts.add(
    {
      description: failure.error.message,
      title: [failure.layer, failure.path, failure.during].filter(Boolean).join(' · '),
    },
    { timeout: 8000 },
  ),
);

// One element for the page's life: the shell renders again at every change of address, and React
// skips an element it showed before.
const failures = (
  <ToastRegion aria-label="Failures" queue={toasts}>
    {({ toast }) => (
      <Toast toast={toast}>
        <ToastContent>
          <Text slot="title">{toast.content.title}</Text>
          <Text slot="description">{toast.content.description}</Text>
        </ToastContent>
        <Button slot="close">Dismiss</Button>
      </Toast>
    )}
  </ToastRegion>
);

// The states gallery: `#/states` lists every chart; `#/states/<path>/<state>` is one frame of it,
// the component alone, held in that state.
function pageOf(hash: string): null | { gallery: true } | { path: string; state: string } {
  if (hash !== STATES && !hash.startsWith(`${STATES}/`)) return null;
  const [path, state] = hash.slice(STATES.length + 1).split('/');
  return path && state ? { path: decodeURIComponent(path), state } : { gallery: true };
}

// One load per chart, kept: a component that suspends before its first commit keeps no state, so
// a promise made in its render would be a new one each time it tries again.
const loading = new Map<string, ReturnType<typeof chartAt>>();
const loadChart = (path: string) => {
  let found = loading.get(path);
  if (!found) loading.set(path, (found = chartAt(path)));
  return found;
};

/** One frame of the gallery: the component at `path`, held in `state`, with its example. */
function Frame({ path, state }: { path: string; state: string }) {
  const found = use(loadChart(path));
  if (!found) return <p>No chart at {path}.</p>;
  const example = found.examples[state];
  const Component = found.component;
  // The frame is not a folder's render, and the component is not Root's own child: its boundaries are composed here.
  return (
    <Pinned example={example} path={path} state={state}>
      {bound(<Component {...example?.props} />)}
    </Pinned>
  );
}

const messages = new Map<string, Promise<unknown>>();

const messagesFor = (locale: string) => {
  let loading = messages.get(locale);

  if (!loading) messages.set(locale, (loading = preloadLocale(locale)));

  return loading;
};

function useSettings({ lang, signin, skin, world }: Settings) {
  return useMemo(() => ({ lang, signin, skin, world }), [lang, signin, skin, world]);
}

/** The address changes the page and its diagnostic location, without rebuilding the providers. */
function Content({ settings }: { settings: Settings }) {
  const location = useLocation();
  const shown = codec.read(location.pathname, location.search, location.hash);
  const page = pageOf(shown.hash);
  useCommitted(shown.href);
  useEffect(() => setLocation(shown.href), [shown.href]);

  return page === null ? (
    <EditingProductContext value={shown.pattern === '/products/:id/edit' ? Number(shown.params['id']) : null}>
      <App pattern={shown.pattern} settings={settings} />
    </EditingProductContext>
  ) : 'gallery' in page ? (
    <States settings={settings} />
  ) : (
    <Frame key={`${page.path}/${page.state}`} path={page.path} state={page.state} />
  );
}

function Shell() {
  const location = useLocation();
  const navigation = useNavigation(codec);
  const shown = codec.read(location.pathname, location.search, location.hash);
  // SAFETY: The generated schema supplies and validates every shell setting.
  const settings = useSettings(settingsOf(shown.query as Settings));
  const locale = currentLocale(shown.query['lang'] as string);
  use(messagesFor(locale));
  const skin = currentSkin(shown.query['skin'] as string);

  const { navigator } = use(NavigationContext);

  const follow = useCallback(
    (href: string) => {
      const url = new URL(href, window.location.href);

      if (url.origin !== window.location.origin || !url.pathname.startsWith(codec.base))
        return window.location.assign(href);
      navigator.push(`${url.pathname}${url.search}${url.hash}`);
    },
    [navigator],
  );

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;

      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute('download') ||
        (anchor.target && anchor.target !== '_self')
      )
        return;
      const url = new URL(anchor.href);

      if (
        url.origin !== window.location.origin ||
        !url.pathname.startsWith(codec.base) ||
        (url.hash && !url.hash.startsWith(STATES))
      )
        return;
      event.preventDefault();
      follow(url.href);
    };

    document.addEventListener('click', click);

    return () => document.removeEventListener('click', click);
  }, [follow]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const canonical = `/${shown.href.slice(codec.base.length)}`;

  const content = useMemo(
    () => (
      <RouterProvider navigate={follow}>
        <I18nProvider locale={locale}>
          <Root
            acl={permissions}
            client={client}
            entity={entity}
            env={env}
            flags={featureFlags}
            locale={locale}
            navigation={navigation}
            skin={skin}
            sync={`stockroom:${world}`}
            user={whoIsSignedIn}
          >
            <Content settings={settings} />
          </Root>
          {failures}
        </I18nProvider>
      </RouterProvider>
    ),
    [follow, locale, navigation, settings, skin],
  );

  return (
    <>
      {content}
      {`${location.pathname}${location.search}${location.hash}` !== canonical && <Navigate replace to={canonical} />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<Pending />}>
        <Shell />
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
