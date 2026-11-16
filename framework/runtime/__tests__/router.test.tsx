import { act, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';

import { createCodec, type RouteDefinition } from '../address';
import { component } from '../component';
import { createQueryClient } from '../data';
import { Root } from '../root';
import { createRouterAddress, guarded, routed } from '../router';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

const id = { id: { min: 1, type: 'integer' } } as const;
const page = { page: { default: 1, min: 1, type: 'integer' } } as const;
const definitions: RouteDefinition[] = [
  { folder: 'confirm', keys: ['id'], owner: 'editor', params: id, path: '/products/:id/edit/confirm', query: page },
  { folder: 'editor', keys: ['id'], owner: 'page', params: id, path: '/products/:id/edit', query: page },
  { folder: 'page', keys: [], owner: 'app', params: {}, path: '/products', query: page },
];
const codec = createCodec(definitions, {}, '/products');
const view = (shown: (props: Record<string, unknown>) => ReactNode) => () =>
  Promise.resolve({
    async: undefined,
    children: [],
    form: undefined,
    props: undefined,
    render: shown,
    state: undefined,
  });
const settled = () => new Promise<void>((resolve) => setTimeout(resolve));
const turn = (work: () => unknown) =>
  act(async () => {
    await work();
    for (let each = 0; each < 5; each++) await settled();
  });

/** The route objects as the plugin writes them, for folders made here. */
function app(start: string) {
  const mounts: string[] = [];
  const folder = (path: string, shown: (props: Record<string, unknown>) => ReactNode, routes = false) =>
    component({
      path,
      ...(routes ? { routes: createElement(Outlet) } : {}),
      skins: {},
      view: view(shown),
    });
  const Page = folder(
    'page',
    ({ routes }) => createElement('main', null, createElement('input', { name: 'q' }), routes as ReactNode),
    true,
  );
  const Editor = folder(
    'editor',
    ({ routes }) => {
      mounts.push('editor');
      return createElement('form', null, createElement('input', { name: 'title' }), routes as ReactNode);
    },
    true,
  );
  const Confirm = folder('confirm', () => createElement('p', null, 'sure?'));
  const client = createQueryClient();
  const Shell = () => createElement(Root, { address, client, entity: { id: 'shop' } as never }, createElement(Outlet));
  const router = createMemoryRouter(
    [
      {
        children: [
          {
            children: [
              {
                children: [
                  {
                    Component: routed(Confirm, '/products/:id/edit/confirm'),
                    handle: { pattern: '/products/:id/edit/confirm' },
                    path: 'confirm',
                  },
                ],
                Component: routed(Editor, '/products/:id/edit'),
                handle: { pattern: '/products/:id/edit' },
                loader: guarded(codec, '/products/:id/edit'),
                path: ':id/edit',
              },
            ],
            Component: routed(Page, '/products'),
            handle: { pattern: '/products' },
            path: 'products',
          },
          { path: '*' },
        ],
        Component: Shell,
        path: '/',
      },
    ],
    { initialEntries: [start] },
  );
  const address = createRouterAddress(codec, router);
  return { address, element: createElement(RouterProvider, { router }), mounts, router };
}

test('a child route shows where its parent places `routes`, and the parent and its native fields stay mounted, in both directions', async () => {
  const { address, element, mounts } = app('/products/4/edit');
  const { container } = await act(async () => render(element));
  await turn(() => undefined);
  const title = container.querySelector<HTMLInputElement>('input[name=title]')!;
  title.value = 'Lamp, edited';
  await turn(() => address.navigation.go('/products/:id/edit/confirm', { id: 4 }));
  expect(container.textContent).toBe('sure?');
  expect(container.querySelector('input[name=title]')).toBe(title);
  await turn(() => address.navigation.go('/products/:id/edit', { id: 4 }));
  expect(container.querySelector('p')).toBeNull();
  expect(container.querySelector<HTMLInputElement>('input[name=title]')!.value).toBe('Lamp, edited');
  // Another product is another instance of the folder: its path on screen is its key.
  const before = mounts.length;
  await turn(() => address.navigation.go('/products/:id/edit', { id: 5 }));
  expect(container.querySelector('input[name=title]')).not.toBe(title);
  expect(mounts.length).toBeGreaterThan(before);
});

test('an address no folder names, a parameter its meta refuses and a default spelled out are replaced by the address the codec writes', async () => {
  for (const [typed, written] of [
    ['/nowhere', '/products'],
    ['/products/four/edit', '/products'],
    ['/products/4/edit?query=%7B%22page%22%3A1%7D', '/products/4/edit'],
    ['/products?query=%7B%22page%22%3A2%2C%22v%22%3A1%7D', '/products?query=%7B%22v%22%3A1%2C%22page%22%3A2%7D'],
  ] as const) {
    const { address, element, router } = app(typed);
    const shown = await act(async () => render(element));
    await turn(() => address.listen());
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(written);
    expect(address.getSnapshot().href).toBe(written);
    shown.unmount();
  }
});

test('everyone is asked before anyone is told; a refused Back is restored by the router, and then Back and Forward can be accepted', async () => {
  const { address, element, router } = app('/products/4/edit');
  const shown = await act(async () => render(element));
  const told: string[] = [];
  let permitted = true;
  address.permit({ agrees: () => true, follows: ({ to }) => void told.push(to.path) });
  address.permit({ agrees: () => permitted, follows: ({ to }) => void told.push(to.path) });
  await turn(() => address.navigation.go('/products/:id/edit/confirm', { id: 4 }));
  expect(told).toEqual(['/products/4/edit/confirm', '/products/4/edit/confirm']);

  permitted = false;
  await turn(() => address.navigation.go('/products'));
  await turn(() => router.navigate(-1));
  expect(address.getSnapshot().path).toBe('/products/4/edit/confirm');
  expect(told).toHaveLength(2);

  permitted = true;
  await turn(() => router.navigate(-1));
  expect(address.getSnapshot().path).toBe('/products/4/edit');
  await turn(() => router.navigate(1));
  expect(address.getSnapshot().path).toBe('/products/4/edit/confirm');
  shown.unmount();
});

test('two changes in a row both hold: the second starts from the address the first asked for', async () => {
  const { address, element } = app('/products/4/edit');
  const shown = await act(async () => render(element));
  await turn(() => {
    address.navigation.query('/products', { page: 3 });
    address.navigation.go('/products/:id/edit/confirm', { id: 4 });
  });
  expect(address.getSnapshot()).toMatchObject({ path: '/products/4/edit/confirm', query: { page: 3 } });
  shown.unmount();
});
