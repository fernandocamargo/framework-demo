// Storybook's stage for the app's components: every story renders inside the app's `Root`, as the
// shell (src/main.tsx) renders the page, in the memory world, with the page's styles. Three
// toolbars: the page's language, the skin it wears, and who is signed in, signed in for real with that role's demo
// account before the story renders, so the session, what may be done and the flags agree. A story
// starts at the address its example names, and then follows its links, as the app does.

import type { Decorator, Preview } from '@storybook/react-vite';
import { type ComponentType, createContext, use } from 'react';
import { I18nProvider, RouterProvider } from 'react-aria-components';
import { createBrowserRouter, createMemoryRouter, type DataRouter } from 'react-router';
import { RouterProvider as Router } from 'react-router/dom';

import { createQueryClient, type Env, Root, type Route } from 'framework';

import { address, codec, follow, start } from '../src/address';
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
// Each person's reads, cached for as long as the stories are open: Root is given a query client, as
// the app gives it one, and each person has their own.
const clients = Object.fromEntries(
  ['guest', ...DEMOS.map(({ role }) => role)].map((role) => [role, createQueryClient()]),
);

// The memory world's API client: the session it keeps is the one every story's `Root` reads.
const api = memory({ env } as never);
async function signInAs(role: string) {
  const demo = DEMOS.find((account) => account.role === role);
  const current = api.session.current();
  if (!demo) return void (current && api.session.signOut());
  if (current?.user.username === demo.username) return;
  await api.session.signIn({ password: demo.password, username: demo.username });
}

/** What a story's frame shows: the story, and the toolbars' choices. The router's root route reads it. */
type Shown = { locale: (typeof LOCALES)[number]; role: string; skin: string; Story: ComponentType };
const ShownContext = createContext<null | Shown>(null);

/** The root route of a story's router: the app's `Root` around the story, as the shell has it around the page. */
function Stage() {
  const { locale, role, skin, Story } = use(ShownContext)!;
  return (
    <RouterProvider navigate={follow}>
      {/* A new Root for each person, so its reads start over for them. */}
      <Root
        acl={permissions}
        address={address}
        client={clients[role]!}
        entity={entity}
        env={env}
        flags={featureFlags}
        key={role}
        locale={locale}
        skin={skin}
        user={whoIsSignedIn}
      >
        <Story />
      </Root>
    </RouterProvider>
  );
}

// Each story has a router of its own, in memory: Storybook's own address is not the story's.
const inRoot: Decorator = (Story, context) => {
  const { locale, role, skin } = context.globals as Omit<Shown, 'Story'>;
  return (
    <I18nProvider locale={locale}>
      <ShownContext value={{ locale, role, skin, Story }}>
        <Router router={context.loaded['router'] as DataRouter} />
      </ShownContext>
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
  loaders: [
    ({ globals, parameters }) => {
      // The address: the story's example first, then wherever its links and `navigation.go` take it.
      const example = (parameters['framework'] as undefined | { route?: Partial<Route> })?.route;
      const href = codec.format(example?.pattern ?? '/products', (example?.params as never) ?? {}, {
        ...example,
        world: 'memory',
      });
      const inMemory: typeof createBrowserRouter = (routes, options) =>
        createMemoryRouter(routes, { ...options, initialEntries: [href] });
      const router = start(Stage, undefined, inMemory);
      return signInAs(globals['role'] as string).then(() => ({ router }));
    },
  ],
  parameters: {
    // Each story of a docs page in a frame of its own: a story's address, its dialogs and its keys
    // stay its own.
    docs: { story: { height: '480px', inline: false } },
    layout: 'padded',
  },
} satisfies Preview;
