// Storybook's stage for the app's components: every story renders inside the app's `Root`, as the
// shell (src/main.tsx) renders the page, in the memory world, with the page's styles. Three
// toolbars: the page's language, the skin it wears, and who is signed in, signed in for real with that role's demo
// account before the story renders, so the session, what may be done and the flags agree. A story
// starts at the address its example names, and then follows its links, as the app does.

import type { Decorator, Preview } from '@storybook/react-vite';
import { type ReactNode, useEffect, useMemo, useState, useTransition } from 'react';
import { I18nProvider } from 'react-aria-components';

import { type Env, type Navigation, Root, type Route } from 'framework';

import { format, go, HOME, parse } from '../src/address';
import memory from '../src/clients/memory';
import { DEMOS } from '../src/components/session/form';
import { LOCALES } from '../src/locales';
import { featureFlags, permissions, whoIsSignedIn } from '../src/reads';
import { SKINS } from '../src/skins';
import '../src/base.css';
import '../src/broadsheet.css';
import '../src/blueprint.css';

const env: Env = { apiUrl: 'https://dummyjson.com', world: 'memory' };
const entity = { id: 'memory' };
const navigation: Navigation = { go };

// The memory world's API client: the session it keeps is the one every story's `Root` reads.
const api = memory({ env } as never);
async function signInAs(role: string) {
  const demo = DEMOS.find((account) => account.role === role);
  const current = api.session.current();
  if (!demo) return void (current && api.session.signOut());
  if (current?.user.username === demo.username) return;
  await api.session.signIn({ password: demo.password, username: demo.username });
}

/** The address: the story's example first, then wherever its links and `navigation.go` take it. */
function Stage({ children, start }: { children: (route: Route) => ReactNode; start: Partial<Route> | undefined }) {
  const [hash, setHash] = useState(() => format({ ...HOME, ...start }));
  const [, navigate] = useTransition();
  useEffect(() => {
    window.location.hash = hash;
    const follow = () => navigate(() => setHash(window.location.hash));
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
    // The story's own address, once, when it mounts.
  }, []);
  const route = useMemo(() => parse(hash), [hash]);
  return children(route);
}

const inRoot: Decorator = (Story, context) => {
  const { locale, role, skin } = context.globals as { locale: (typeof LOCALES)[number]; role: string; skin: string };
  const start = (context.parameters['framework'] as undefined | { route?: Partial<Route> })?.route;
  return (
    <I18nProvider locale={locale}>
      <Stage start={start}>
        {(route) => (
          // A new Root for each person, so its reads start over for them.
          <Root
            acl={permissions}
            entity={entity}
            env={env}
            flags={featureFlags}
            key={role}
            locale={locale}
            navigation={navigation}
            route={route}
            skin={skin}
            user={whoIsSignedIn}
          >
            <Story />
          </Root>
        )}
      </Stage>
    </I18nProvider>
  );
};

export default {
  decorators: [inRoot],
  globalTypes: {
    locale: {
      description: "The page's language",
      toolbar: {
        dynamicTitle: true,
        icon: 'globe',
        items: LOCALES.map((value) => ({ title: value === 'en' ? 'English' : 'Português (Brasil)', value })),
        title: 'Language',
      },
    },
    role: {
      description: 'Who is signed in',
      toolbar: {
        dynamicTitle: true,
        icon: 'user',
        items: [
          { title: 'Nobody', value: 'guest' },
          ...DEMOS.map(({ name, role }) => ({ title: `${name}, ${role}`, value: role })),
        ],
        title: 'Signed in as',
      },
    },
    skin: {
      description: 'The skin the page wears',
      toolbar: {
        dynamicTitle: true,
        icon: 'paintbrush',
        items: SKINS.map((value) => ({ title: value[0]!.toUpperCase() + value.slice(1), value })),
        title: 'Skin',
      },
    },
  },
  initialGlobals: { locale: 'en', role: 'guest', skin: 'default' },
  loaders: [({ globals }) => signInAs(globals['role'] as string)],
  parameters: {
    // Each story of a docs page in a frame of its own: a story's address, its dialogs and its keys
    // stay its own.
    docs: { story: { height: '480px', inline: false } },
    layout: 'padded',
  },
} satisfies Preview;
