// The app's shell: everything outside the framework's root folders. It decides which world the
// app sees, hands `Root` what the framework injects, and shows what the
// failure pipeline carries. The app itself starts at components/app.

import { StrictMode, use, useEffect } from 'react';
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
import { RouterProvider as Router } from 'react-router/dom';

import {
  chartAt,
  createQueryClient,
  type Env,
  onFailure,
  Pinned,
  Root,
  type Route,
  Routing,
  useAddress,
  usePreparing,
  useShown,
} from 'framework';

import { address, follow, navigation, samePage, start, STATES } from './address';
import App from './components/app';
import States from './components/states';
import { fromLegacy } from './legacy';
import { currentLocale } from './locales';
import { featureFlags, permissions, whoIsSignedIn } from './reads';
import { currentSkin } from './skins';
import './base.css';
import './broadsheet.css';
import './blueprint.css';

// A bookmark from before the routes opens its new address (legacy.ts).
const moved = fromLegacy(window.location);
if (moved !== null) window.history.replaceState(window.history.state, '', moved);
// The router of this document, with the shell below as its root route. The gallery continues to
// use its development hash.
const router = start(Shell);
const stopAddress = address.listen(window);
if (import.meta.hot) import.meta.hot.dispose(stopAddress);
const world: Env['world'] =
  address.getSnapshot().query['world'] === 'memory' || import.meta.env['VITE_WORLD'] === 'memory'
    ? 'memory'
    : 'dummyjson';
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
  return (
    <Pinned example={example} path={path} state={state}>
      <Component {...example?.props} />
    </Pinned>
  );
}

function Shell() {
  // The address in the bar, and the one on screen: the router shows its location in a transition,
  // so the page stays until the next one is ready.
  const snapshot = useAddress(address);
  const shown = useShown(address);
  const preparing = usePreparing();
  const route = shown.route as unknown as Route;
  // A page is being read. Another language or skin is not another page: it shows when it is ready,
  // and the page on screen is not busy meanwhile.
  const navigating = preparing || !samePage(snapshot, shown);
  const locale = currentLocale(shown.query['lang'] as string);
  const skin = currentSkin(shown.query['skin'] as string);
  const page = pageOf(shown.hash);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <Routing address={address}>
      <RouterProvider navigate={follow}>
        <I18nProvider locale={locale}>
          <Root
            acl={permissions}
            client={client}
            entity={entity}
            env={env}
            flags={featureFlags}
            locale={locale}
            location={shown.href}
            navigation={navigation}
            route={route}
            skin={skin}
            sync={`stockroom:${world}`}
            user={whoIsSignedIn}
          >
            {page === null ? (
              <App navigating={navigating} />
            ) : 'gallery' in page ? (
              <States />
            ) : (
              <Frame key={`${page.path}/${page.state}`} path={page.path} state={page.state} />
            )}
          </Root>
          {failures}
        </I18nProvider>
      </RouterProvider>
    </Routing>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router router={router} />
  </StrictMode>,
);
