// The app's shell: everything outside the framework's root folders. It decides which world the
// app sees, stands in for a router, hands `Root` what the framework injects, and shows what the
// failure pipeline carries. The app itself starts at components/app.

import { StrictMode, use, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Button,
  I18nProvider,
  Text,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from 'react-aria-components';
import { createRoot } from 'react-dom/client';

import { chartAt, createQueryClient, type Env, type Navigation, onFailure, Pinned, Root } from 'framework';

import { go, parse } from './address';
import App from './components/app';
import States from './components/states';
import { currentLocale, type Locale } from './locales';
import { featureFlags, permissions, whoIsSignedIn } from './reads';
import { currentSkin, type Skin } from './skins';
import './base.css';
import './broadsheet.css';
import './blueprint.css';

// `?world=memory` (or a build with VITE_WORLD=memory) swaps the API client for one that answers
// from fixtures. Nothing else changes: the same services, flows and components run on it.
const world: Env['world'] =
  new URLSearchParams(window.location.search).get('world') === 'memory' || import.meta.env['VITE_WORLD'] === 'memory'
    ? 'memory'
    : 'dummyjson';
// GrowthBook serves the real world's flags when its client key is in the build (.env.local).
const env: Env = { apiUrl: 'https://dummyjson.com', flagsKey: import.meta.env['VITE_GROWTHBOOK_CLIENT_KEY'], world };
const entity = { id: world };
const navigation: Navigation = { go };
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

// The address changes inside a transition: a page whose read is keyed by the address keeps
// showing until the new read arrives, instead of falling back to its placeholder.
function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  const [navigating, startNavigation] = useTransition();
  useEffect(() => {
    const follow = () => startNavigation(() => setHash(window.location.hash));
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);
  return [useMemo(() => parse(hash), [hash]), navigating, hash] as const;
}

// The states gallery: `#/states` lists every chart; `#/states/<path>/<state>` is one frame of it,
// the component alone, held in that state.
const STATES = '#/states';
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

// The locale is part of the address too (`?lang=pt-BR`, src/locales.ts). A change shows in a
// transition: the page keeps the old locale on screen until every component on it has its new
// messages, then shows the new one at once. react-aria formats its own fields (a price field, a
// percentage) in the same locale.
function useLocale() {
  const [locale, setLocale] = useState<Locale>(currentLocale);
  const [, startSwitch] = useTransition();
  useEffect(() => {
    const follow = () => startSwitch(() => setLocale(currentLocale()));
    window.addEventListener('localechange', follow);
    window.addEventListener('popstate', follow);
    return () => {
      window.removeEventListener('localechange', follow);
      window.removeEventListener('popstate', follow);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return locale;
}

// The skin is part of the address too (`?skin=broadsheet`, src/skins.ts). A change shows in a
// transition: the page keeps the old skin until every component on it has its new sheet.
function useSkin() {
  const [skin, setSkin] = useState<Skin>(currentSkin);
  const [, startSwitch] = useTransition();
  useEffect(() => {
    const follow = () => startSwitch(() => setSkin(currentSkin()));
    window.addEventListener('skinchange', follow);
    window.addEventListener('popstate', follow);
    return () => {
      window.removeEventListener('skinchange', follow);
      window.removeEventListener('popstate', follow);
    };
  }, []);
  return skin;
}

function Shell() {
  const [route, navigating, hash] = useRoute();
  const locale = useLocale();
  const skin = useSkin();
  const page = pageOf(hash);
  return (
    <I18nProvider locale={locale}>
      <Root
        acl={permissions}
        client={client}
        entity={entity}
        env={env}
        flags={featureFlags}
        locale={locale}
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
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
