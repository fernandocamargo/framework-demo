import { act, render } from '@testing-library/react';
import { type ReactNode } from 'react';

import { createAddress, createCodec, type RouteDefinition } from '../address';
import { addressedActor, followChart } from '../chart-address';
import { component } from '../component';
import { createQueryClient } from '../data';
import { buildMachine } from '../machine';
import { Root } from '../root';
import { Routes, RouteScope, Routing } from '../routes';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

const definitions: RouteDefinition[] = [
  {
    folder: 'confirm',
    keys: ['id'],
    owner: 'editor',
    params: { id: { min: 1, type: 'integer' } },
    path: '/products/:id/edit/confirm',
    query: {},
    test: /^\/products\/([^/]+)\/edit\/confirm$/,
  },
  {
    folder: 'editor',
    keys: ['id'],
    owner: 'page',
    params: { id: { min: 1, type: 'integer' } },
    path: '/products/:id/edit',
    query: {},
    test: /^\/products\/([^/]+)\/edit$/,
  },
  { folder: 'page', keys: [], owner: 'app', params: {}, path: '/products', query: {}, test: /^\/products$/ },
];
const codec = createCodec(definitions, {}, '/products');
const view = (render: (props: Record<string, unknown>) => ReactNode) => () =>
  Promise.resolve({ async: undefined, form: undefined, props: undefined, render, state: undefined });

test('a child dialog keeps its editor and its native field mounted underneath, in both directions', async () => {
  const address = createAddress(codec, { initial: '/products/4/edit' });
  const Page = component({
    path: 'page',
    routes: <Routes owner="page" />,
    skins: {},
    view: view(({ routes }) => <main>{routes as ReactNode}</main>),
  });
  const Editor = component({
    path: 'editor',
    routes: <Routes owner="editor" />,
    skins: {},
    view: view(({ routes }) => (
      <>
        <input aria-label="Title" defaultValue="Lamp" />
        {routes as ReactNode}
      </>
    )),
  });
  const Confirm = component({ path: 'confirm', skins: {}, view: view(() => <aside>Confirm</aside>) });
  let shown: ReturnType<typeof render>;
  await act(async () => {
    shown = render(
      <Routing address={address} components={{ confirm: Confirm, editor: Editor, page: Page }}>
        <Root client={createQueryClient()}>
          <Routes owner="app" />
        </Root>
      </Routing>,
    );
  });
  const input = shown!.getByRole('textbox') as HTMLInputElement;
  input.value = 'The draft';
  await act(async () => address.navigation.go('/products/:id/edit/confirm', { id: 4 }));
  expect(shown!.getByRole('textbox')).toBe(input);
  expect(input.value).toBe('The draft');
  expect(shown!.getByText('Confirm')).toBeTruthy();
  await act(async () => address.navigation.go('/products/:id/edit', { id: 4 }));
  expect(shown!.getByRole('textbox')).toBe(input);
  expect(shown!.queryByText('Confirm')).toBeNull();
  shown!.unmount();
});

const chart = (mayLeave: () => boolean) => ({
  default: {
    editing: { on: { address: { target: 'confirming' }, confirm: 'confirming', lock: 'locked' } },
    confirming: {
      meta: { route: 'confirm' },
      on: { address: { guard: mayLeave, target: 'editing' }, back: 'editing' },
    },
    // A state that takes no address.
    locked: {},
  },
});
const start = (address: ReturnType<typeof createAddress>, mayLeave = () => true) => {
  const routing = { address, base: '/products/4/edit', pattern: '/products/:id/edit' };
  const { machine, routes } = buildMachine('editor', chart(mayLeave), {}, { current: {} }, routing);
  const actor = addressedActor(machine, routes, routing, address.getSnapshot().pattern);
  const unfollow = followChart(actor, routes, routing);
  actor.start();
  return {
    actor,
    stop: () => {
      unfollow();
      actor.stop();
    },
  };
};

test('a direct child address resolves the chart before it starts, and leaving the state writes its parent address', () => {
  const address = createAddress(codec, { initial: '/products/4/edit/confirm' });
  const { actor, stop } = start(address);
  expect(actor.getSnapshot().matches('confirming')).toBe(true);
  actor.send({ type: 'back' });
  expect(address.getSnapshot().path).toBe('/products/4/edit');
  actor.send({ type: 'confirm' });
  expect(address.getSnapshot().path).toBe('/products/4/edit/confirm');
  stop();
});

const traversed = () =>
  new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));

test('a chart shown outside its owning route does not write an unrelated address', async () => {
  const address = createAddress(
    createCodec(
      definitions.map((route) =>
        route.folder === 'confirm' ? { ...route, chart: { component: 'editor', state: 'confirming' } } : route,
      ),
      {},
      '/products',
    ),
  );
  const Editor = component({
    path: 'editor',
    skins: {},
    view: () =>
      Promise.resolve({
        async: undefined,
        form: undefined,
        props: undefined,
        render: ({ state }: Record<string, unknown>) => {
          const current = state as { confirming: boolean; send: (event: { type: string }) => void };
          return (
            <button onClick={() => current.send({ type: 'confirm' })}>
              {current.confirming ? 'Confirmed' : 'Confirm'}
            </button>
          );
        },
        state: chart(() => true),
      }),
  });
  let shown: ReturnType<typeof render>;
  await act(async () => {
    shown = render(
      <Routing address={address} components={{}}>
        <RouteScope value={{ base: '/products', pattern: '/products' }}>
          <Root client={createQueryClient()}>
            <Editor />
          </Root>
        </RouteScope>
      </Routing>,
    );
  });
  await act(async () => shown!.getByRole('button').click());
  expect(shown!.getByRole('button').textContent).toBe('Confirmed');
  expect(address.getSnapshot().path).toBe('/products');
  shown!.unmount();
});

test('Back is an event a guard can refuse; History restores the entry, then Back and Forward can be accepted', async () => {
  window.history.replaceState(null, '', '/products/4/edit');
  const address = createAddress(codec, { browser: window });
  const unlisten = address.listen();
  let permitted = false;
  const { actor, stop } = start(address, () => permitted);
  actor.send({ type: 'confirm' });
  const restored = new Promise<void>((resolve) => {
    const listener = () => {
      if (window.location.pathname.endsWith('/confirm')) {
        window.removeEventListener('popstate', listener);
        resolve();
      }
    };
    window.addEventListener('popstate', listener);
  });
  window.history.back();
  await restored;
  expect(actor.getSnapshot().matches('confirming')).toBe(true);
  expect(address.getSnapshot().path).toBe('/products/4/edit/confirm');
  permitted = true;
  let pending = traversed();
  window.history.back();
  await pending;
  expect(actor.getSnapshot().matches('editing')).toBe(true);
  expect(address.getSnapshot().path).toBe('/products/4/edit');
  pending = traversed();
  window.history.forward();
  await pending;
  expect(actor.getSnapshot().matches('confirming')).toBe(true);
  expect(address.getSnapshot().path).toBe('/products/4/edit/confirm');
  stop();
  unlisten();
});

test('links keep native modified clicks, downloads, external URLs and anchors', () => {
  window.history.replaceState(null, '', '/products');
  const address = createAddress(codec, { browser: window });
  const stop = address.listen();
  const a = document.createElement('a');
  a.href = '/products/4/edit';
  document.body.append(a);
  const modified = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
  a.dispatchEvent(modified);
  expect(modified.defaultPrevented).toBe(false);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  a.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(address.getSnapshot().path).toBe('/products/4/edit');
  a.remove();
  stop();
});

const settled = (path: string) =>
  new Promise<void>((resolve) => {
    const listener = () => {
      if (window.location.pathname !== path) return;
      window.removeEventListener('popstate', listener);
      resolve();
    };
    window.addEventListener('popstate', listener);
  });

test('everyone is asked before anyone is told: a refusal leaves the others where they were', () => {
  const address = createAddress(codec, { initial: '/products' });
  const told: string[] = [];
  address.permit({ agrees: () => true, follows: ({ to }) => void told.push(to.path) });
  const leave = address.permit({ agrees: () => false, follows: ({ to }) => void told.push(to.path) });
  address.navigation.go('/products/:id/edit', { id: 4 });
  expect(address.getSnapshot().path).toBe('/products');
  expect(told).toEqual([]);
  leave();
  address.navigation.go('/products/:id/edit', { id: 4 });
  expect(told).toEqual(['/products/4/edit']);
});

test('a navigation made while a change is being followed is made, after it', () => {
  const address = createAddress(codec, { initial: '/products' });
  address.permit({
    agrees: () => true,
    follows: ({ to }) => {
      if (to.path === '/products/4/edit') address.navigation.go('/products/:id/edit', { id: 5 });
    },
  });
  address.navigation.go('/products/:id/edit', { id: 4 });
  expect(address.getSnapshot().path).toBe('/products/5/edit');
});

test('a chart writes its address only while the address is one of its own', () => {
  const address = createAddress(codec, { initial: '/products' });
  const own = { base: '/products/4/edit', pattern: '/products/:id/edit', segments: ['confirm'] };
  address.hold(own, 'confirm');
  expect(address.getSnapshot().path).toBe('/products');
  address.navigation.go('/products/:id/edit', { id: 5 });
  address.hold(own, 'confirm');
  expect(address.getSnapshot().path).toBe('/products/5/edit');
  address.navigation.go('/products/:id/edit', { id: 4 });
  address.hold(own, 'confirm');
  expect(address.getSnapshot().path).toBe('/products/4/edit/confirm');
});

test('leaving a state that names an address replaces its entry: Back passes it', async () => {
  window.history.replaceState(null, '', '/products');
  const address = createAddress(codec, { browser: window });
  const unlisten = address.listen();
  address.navigation.go('/products/:id/edit', { id: 4 });
  const { actor, stop } = start(address);
  const entries = window.history.length;
  actor.send({ type: 'confirm' });
  expect(window.history.length).toBe(entries + 1);
  actor.send({ type: 'back' });
  expect(address.getSnapshot().path).toBe('/products/4/edit');
  expect(window.history.length).toBe(entries + 1);
  // The entry the confirmation was: the same address, so nothing is asked of the chart.
  let pending = traversed();
  window.history.back();
  await pending;
  expect(address.getSnapshot().path).toBe('/products/4/edit');
  pending = traversed();
  window.history.back();
  await pending;
  expect(address.getSnapshot().path).toBe('/products');
  stop();
  unlisten();
});

test('Back to an address the chart cannot enter passes: the entry takes the address of the state it is in', async () => {
  window.history.replaceState(null, '', '/products/4/edit/confirm');
  const address = createAddress(codec, { browser: window });
  const unlisten = address.listen();
  // A link leaves the confirmation by a new entry, and the chart then moves where it takes no address.
  const { actor, stop } = start(address);
  address.navigation.go('/products/:id/edit', { id: 4 });
  expect(actor.getSnapshot().matches('editing')).toBe(true);
  actor.send({ type: 'lock' });
  const pending = traversed();
  window.history.back();
  await pending;
  expect(actor.getSnapshot().matches('locked')).toBe(true);
  expect(window.location.pathname).toBe('/products/4/edit');
  expect(address.getSnapshot().path).toBe('/products/4/edit');
  stop();
  unlisten();
});

test('a refused traversal after a reload goes back to the entry it left', async () => {
  window.history.replaceState(null, '', '/products');
  const first = createAddress(codec, { browser: window });
  const unlisten = first.listen();
  first.navigation.go('/products/:id/edit', { id: 4 });
  first.navigation.go('/products/:id/edit', { id: 5 });
  first.navigation.go('/products/:id/edit', { id: 6 });
  unlisten();
  // A reload: another store on the same History, on its last entry.
  const address = createAddress(codec, { browser: window });
  const stop = address.listen();
  const leave = address.permit({ agrees: () => false, follows: () => undefined });
  const restored = settled('/products/6/edit');
  window.history.back();
  await restored;
  expect(address.getSnapshot().path).toBe('/products/6/edit');
  leave();
  const pending = traversed();
  window.history.back();
  await pending;
  expect(address.getSnapshot().path).toBe('/products/5/edit');
  stop();
});

test("a link is followed in place when its address is the app's; a hash only when the shell owns it", () => {
  window.history.replaceState(null, '', '/products');
  const address = createAddress(codec, { browser: window, hashes: (hash) => hash === '#/tool' });
  expect(address.open('/products/4/edit')).toBe(true);
  expect(address.getSnapshot().path).toBe('/products/4/edit');
  expect(address.open('/products#/tool')).toBe(true);
  expect(address.getSnapshot().hash).toBe('#/tool');
  expect(address.open('/products#section')).toBe(false);
  expect(address.open('/elsewhere')).toBe(false);
  expect(address.open('https://example.com/products')).toBe(false);
});
