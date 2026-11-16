import { act, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';

const wrappers = vi.hoisted(() => new Map<string, number>());

// React DevTools' hook, before React loads: it counts each framework component React renders in a
// commit, even one whose output is the same (perf/recorder.js does the same for the whole app).
const rendered = vi.hoisted(() => {
  const counts = new Map<string, number>();
  const PERFORMED_WORK = 1;
  type Fiber = {
    alternate: Fiber | null;
    child: Fiber | null;
    flags: number;
    memoizedProps: { address?: object };
    sibling: Fiber | null;
    tag: number;
    type: unknown;
  };
  const walk = (parent: Fiber) => {
    if (parent.alternate && parent.child === parent.alternate.child) return;
    for (let node = parent.child; node; node = node.sibling) {
      // SAFETY: React's memo fiber holds its wrapped component as type.type.
      const wrapper =
        node.tag === 14 ? (node.type as { type?: { displayName?: string } }).type?.displayName : undefined;

      if (wrapper && (!node.alternate || (node.flags & PERFORMED_WORK) === PERFORMED_WORK))
        wrappers.set(wrapper, (wrappers.get(wrapper) ?? 0) + 1);

      const type = typeof node.type === 'function' ? (node.type as { displayName?: string; name: string }) : null;
      const view = type !== null && type.name === 'View';
      // DevTools inspects props too; that must not subscribe a view to fields its files never read.

      if (view && node.memoizedProps.address) Object.entries(node.memoizedProps.address);
      if (view && node.alternate && (node.flags & PERFORMED_WORK) === PERFORMED_WORK)
        counts.set(type.displayName!, (counts.get(type.displayName!) ?? 0) + 1);
      walk(node);
    }
  };
  const renderers = new Map<number, unknown>();
  (globalThis as Record<string, unknown>)['__REACT_DEVTOOLS_GLOBAL_HOOK__'] = {
    checkDCE() {},
    inject: (renderer: unknown) => (renderers.set(renderers.size + 1, renderer), renderers.size),
    isDisabled: false,
    onCommitFiberRoot: (_: number, root: { current: Fiber }) => walk(root.current),
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onScheduleFiberRoot() {},
    renderers,
    setStrictMode() {},
    supportsFiber: true,
  };
  return counts;
});

import { isBusy } from '../activity';
import { createCodec } from '../address';
import { component } from '../component';
import { createQueryClient } from '../data';
import type { Navigation } from '../index';
import { Root } from '../root';
import { useNavigation, useRoute } from '../routing';
import { routed, useTestRoute } from './routed';

vi.mock('virtual:framework/clients', () => ({ default: {}, env: {} }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type Props = Record<string, unknown>;
const entity = { id: 'shop' } as never;
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
async function show(element: ReactNode) {
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(element);
  });
  await settle();
  const { container, rerender } = shown!;
  return {
    container,
    rerender: async (next: ReactNode) => {
      await act(async () => rerender(next));
      await settle();
    },
  };
}
const module = (parts: Props) => () =>
  Promise.resolve({
    async: undefined,
    children: [],
    form: undefined,
    props: undefined,
    state: undefined,
    ...parts,
  }) as never;

const SAMPLE = { edit: 0, page: 0, q: '', view: 0 };
/** `tree` under a Root at `start`, in a memory router; `go` moves the address and lets the page settle. */
async function at(start: Props, tree: ReactNode) {
  const client = createQueryClient();
  // SAFETY: These synthetic route values are the primitive fields declared by the test.
  const page = routed(SAMPLE, start as never, () => createElement(Root, { client, entity }, tree));
  const { container } = await show(page.element);
  return {
    container,
    go: async (route: Props) => {
      await page.go(route as never);
      await settle();
    },
  };
}

test('a folder that does not read the router uses one view fiber without a memo wrapper', async () => {
  const Plain = component({
    path: 'components/plain-view',
    skins: {},
    view: module({ render: ({ text }: { text: string }) => createElement('p', null, text) }),
  });

  const client = createQueryClient();
  const page = (text: string) => createElement(Root, { client, entity }, createElement(Plain, { text }));
  const { container, rerender } = await show(page('one'));
  rendered.clear();
  await rerender(page('two'));
  expect(container.textContent).toBe('two');
  expect(rendered.get('components/plain-view')).toBe(1);
  expect(wrappers.get('components/plain-view')).toBeUndefined();
});

test('a component with a default read follows only the address fields its read used', async () => {
  const reads: unknown[] = [];
  const List = component({
    path: 'components/list',
    reads: { async: ['route'] },
    skins: {},
    useRoute: useTestRoute,
    view: module({
      async: {
        default: ({ route }: { route: Props }) => {
          reads.push(route['page']);
          return Promise.resolve({ page: route['page'] });
        },
      },
      render: (props: Props) =>
        createElement('p', null, `page ${(props['async'] as { default: { page: number } }).default.page}`),
    }),
  });
  const { container, go } = await at({ page: 1 }, createElement(List));
  expect(container.textContent).toBe('page 1');
  expect(reads).toEqual([1]);
  rendered.clear();

  // A dialog opens over the list: its page is unchanged, so neither the view nor its read runs.
  await go({ page: 1, view: 7 });
  expect(rendered.get('components/list')).toBeUndefined();
  expect(reads).toEqual([1]);

  await go({ page: 2, view: 7 });
  expect(container.textContent).toBe('page 2');
  expect(reads).toEqual([1, 2]);
});

test('a route folder whose chart reads the route follows the router', async () => {
  const Editor = component({
    path: 'components/editor',
    reads: { state: ['route'] },
    skins: {},
    useRoute: useTestRoute,
    view: module({
      render: (props: Props) =>
        createElement('p', null, String((props['state'] as { context: { id: unknown } }).context.id)),
      state: { context: ({ route }: { route: Props }) => ({ id: route['edit'] }), default: { editing: {} } },
    }),
  });
  const { container, go } = await at({ edit: 4, q: 'lamp' }, createElement(Editor));
  expect(container.textContent).toBe('4');
  rendered.clear();

  await go({ edit: 4, q: 'desk' });
  expect(rendered.get('components/editor')).toBeGreaterThan(0);
});

test('a view follows the route fields its files read, and its handlers use the rendered address', async () => {
  const pressed: unknown[] = [];
  const renders: unknown[] = [];
  const Button = component({
    path: 'components/sell',
    reads: { view: ['route'] },
    skins: {},
    useRoute: useTestRoute,
    view: module({
      props: {
        default: ({ route }: { route: Props }) => ({
          edit: () => pressed.push(route['edit']),
          editing: route['edit'] !== undefined,
        }),
      },
      render: (props: Props) => {
        renders.push(props['editing']);
        return createElement('button', { onClick: props['edit'] as () => void }, props['editing'] ? 'on' : 'off');
      },
    }),
  });
  const { container, go } = await at({ page: 1 }, createElement(Button));
  expect(container.textContent).toBe('off');
  rendered.clear();

  // A field its files do not read leaves the view alone.
  await go({ page: 2 });
  expect(rendered.get('components/sell')).toBeUndefined();
  expect(container.textContent).toBe('off');

  await go({ edit: 4, page: 2 });
  expect(container.textContent).toBe('on');

  await act(async () => container.querySelector('button')!.click());
  expect(pressed).toEqual([4]);
});

test('a view that spreads the route gets all of it', async () => {
  const Link = component({
    path: 'components/address',
    reads: { view: ['route'] },
    skins: {},
    useRoute: useTestRoute,
    view: module({
      props: { default: ({ route }: { route: Props }) => ({ text: JSON.stringify({ ...route }) }) },
      render: (props: Props) => createElement('a', null, props['text'] as string),
    }),
  });
  const { container, go } = await at({ page: 1 }, createElement(Link));
  rendered.clear();
  await go({ page: 2 });
  expect(JSON.parse(container.textContent!)).toEqual({ page: 2, params: {}, path: '/page', pattern: '/page' });
  expect(rendered.get('components/address')).toBeGreaterThan(0);
});

test('a failed read shows the error file until the address moves on: a new value of a field it read reads again', async () => {
  const List = component({
    error: () => createElement('p', null, 'failed'),
    path: 'components/failing',
    reads: { async: ['route'] },
    skins: {},
    useRoute: useTestRoute,
    view: module({
      async: {
        default: ({ route }: { route: Props }) =>
          route['page'] === 3 ? Promise.reject(new Error('page 3 failed')) : Promise.resolve({ page: route['page'] }),
      },
      render: (props: Props) =>
        createElement('p', null, `page ${(props['async'] as { default: { page: number } }).default.page}`),
    }),
  });
  const silenced = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const { container, go } = await at({ page: 3 }, createElement(List));
  expect(container.textContent).toBe('failed');

  await go({ page: 1 });
  expect(container.textContent).toBe('page 1');
  silenced.mockRestore();
});

test('a render that reads the route itself, with no props.ts, gets the route React Router renders', async () => {
  const Crumb = component({
    path: 'components/crumb',
    reads: { view: ['route'] },
    skins: {},
    useRoute: useTestRoute,
    view: module({
      render: ({ route }: { route: Props }) => createElement('i', null, `page ${String(route['page'])}`),
    }),
  });
  const { container, go } = await at({ page: 1 }, createElement(Crumb));
  expect(container.textContent).toBe('page 1');

  await go({ edit: 4, page: 2 });
  expect(container.textContent).toBe('page 2');
});

test('a route passes only its filter to a child: opening a dialog renders no row and makes no read', async () => {
  const reads: number[] = [];

  const List = component({
    path: 'components/catalogue',
    reads: { async: ['page'] },
    skins: {},
    view: module({
      async: {
        default: ({ page }: { page: number }) => {
          reads.push(page);

          return Promise.resolve(page);
        },
      },
      render: ({ async }: { async: { default: number } }) => createElement('p', null, `page ${async.default}`),
    }),
  });

  const Products = component({
    path: 'components/app/routes/products',
    reads: { view: ['route'] },
    skins: {},
    useRoute: useTestRoute,
    view: module({
      props: { default: ({ route }: { route: { page: number } }) => ({ page: route.page }) },
      render: ({ page }: { page: number }) => createElement(List, { page }),
    }),
  });

  const { container, go } = await at({ page: 1 }, createElement(Products));
  rendered.clear();
  await go({ page: 1, view: 4 });
  expect(reads).toEqual([1]);
  expect(rendered.get('components/catalogue')).toBeUndefined();
  await go({ page: 2, view: 4 });
  expect(container.textContent).toBe('page 2');
  expect(reads).toEqual([1, 2]);
});

test('a skin changes no folder, and a locale changes only the folders that speak it', async () => {
  let finishSkin!: (sheet: { default: string }) => void;

  const skin = new Promise<{ default: string }>((resolve) => {
    finishSkin = resolve;
  });

  const Spoken = component({
    i18n: { default: { title: 'Title' } },
    path: 'components/spoken',
    skins: {},
    translations: { 'pt-BR': () => Promise.resolve({ default: { 'components/spoken/title': 'Título' } }) },
    view: module({ render: ({ i18n }: { i18n: { title: string } }) => createElement('p', null, i18n.title) }),
  });

  const Plain = component({
    path: 'components/plain-parent',
    skins: {
      blueprint: () => skin,
      default: () => Promise.resolve({ default: '' }),
    },
    view: module({ children: [Spoken], render: () => createElement('section', null, createElement(Spoken)) }),
  });

  const client = createQueryClient();
  const tree = createElement(Plain);
  const page = (locale: string, skin: string) => createElement(Root, { client, entity, locale, skin }, tree);
  const { container, rerender } = await show(page('en', 'default'));
  const section = container.querySelector('section');
  rendered.clear();
  await rerender(page('en', 'blueprint'));
  expect(document.documentElement.dataset['skin']).toBe('default');
  expect(isBusy()).toBe(true);
  await act(async () => finishSkin({ default: '' }));
  await settle();
  expect(document.documentElement.dataset['skin']).toBe('blueprint');
  expect(rendered.size).toBe(0);
  expect(container.querySelector('section')).toBe(section);
  await rerender(page('pt-BR', 'blueprint'));
  expect(container.textContent).toBe('Título');
  expect(rendered.get('components/plain-parent')).toBeUndefined();
  expect(rendered.get('components/spoken')).toBeGreaterThan(0);
});

test('the static child Routes still match when the parent view skips a navigation', async () => {
  const query = { page: { default: 1, type: 'integer' as const } };

  const codec = createCodec(
    [
      { folder: 'products', keys: [], owner: 'app', params: {}, path: '/products', query },
      {
        folder: 'detail',
        keys: ['id'],
        owner: 'products',
        params: { id: { type: 'integer' } },
        path: '/products/:id',
        query,
      },
    ],
    {},
    '/products',
  );

  let navigation!: Navigation;

  function Commands() {
    navigation = useNavigation(codec);

    return null;
  }

  const Detail = component({
    path: 'components/nested-detail',
    reads: { view: ['route'] },
    skins: {},
    useRoute: () => useRoute(codec),
    view: module({
      props: { default: ({ route }: { route: { params: { id: number } } }) => ({ id: route.params.id }) },
      render: ({ id }: { id: number }) => createElement('p', null, `detail ${id}`),
    }),
  });

  const routes = createElement(Routes, null, createElement(Route, { element: createElement(Detail), path: ':id' }));
  const received: unknown[] = [];

  const Products = component({
    path: 'components/nested-products',
    reads: { view: ['route'] },
    routes,
    skins: {},
    useRoute: () => useRoute(codec),
    view: module({
      props: {
        default: ({ route, routes }: { route: { page: number }; routes: ReactNode }) => {
          received.push(routes);

          return { filters: { page: route.page }, routes };
        },
      },
      render: ({ filters, routes }: { filters: { page: number }; routes: ReactNode }) =>
        createElement('section', null, `page ${filters.page}`, routes),
    }),
  });

  const { container } = await show(
    createElement(
      MemoryRouter,
      { initialEntries: ['/products'] },
      createElement(
        Root,
        { client: createQueryClient(), entity },
        createElement(Commands),
        createElement(Routes, null, createElement(Route, { element: createElement(Products), path: 'products/*' })),
      ),
    ),
  );

  rendered.clear();
  await act(async () => navigation.go('/products/:id', { id: 4 }));
  await settle();
  expect(container.textContent).toBe('page 1detail 4');
  expect(rendered.get('components/nested-products')).toBeUndefined();
  rendered.clear();
  await act(async () => navigation.query('/products', { page: 2 }));
  await settle();
  expect(container.textContent).toBe('page 2detail 4');
  expect(rendered.get('components/nested-detail')).toBeUndefined();
  expect(received.every((value) => value === routes)).toBe(true);
  rendered.clear();
  await act(async () => navigation.go('/products'));
  await settle();
  expect(container.textContent).toBe('page 2');
  expect(rendered.get('components/nested-products')).toBeUndefined();
});
