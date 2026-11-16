import { act, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

// React DevTools' hook, before React loads: it counts each framework component React renders in a
// commit, even one whose output is the same (perf/recorder.js does the same for the whole app).
const rendered = vi.hoisted(() => {
  const counts = new Map<string, number>();
  const PERFORMED_WORK = 1;
  type Fiber = {
    alternate: Fiber | null;
    child: Fiber | null;
    flags: number;
    sibling: Fiber | null;
    tag: number;
    type: unknown;
  };
  const walk = (parent: Fiber) => {
    if (parent.alternate && parent.child === parent.alternate.child) return;
    for (let node = parent.child; node; node = node.sibling) {
      const type = typeof node.type === 'function' ? (node.type as { displayName?: string; name: string }) : null;
      const view = type !== null && type.name === 'View';
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

import { component } from '../component';
import { createQueryClient } from '../data';
import { Root } from '../root';
import { routed } from './routed';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
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
  const page = routed(SAMPLE, start as never, (address) => createElement(Root, { address, client, entity }, tree));
  const { container } = await show(page.element);
  return {
    container,
    go: async (route: Props) => {
      await page.go(route as never);
      await settle();
    },
  };
}

test('a component with a default read renders at each change of address, and reads again only for the fields its read used', async () => {
  const reads: unknown[] = [];
  const List = component({
    path: 'components/list',
    reads: { async: ['route'] },
    skins: {},
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

  // A dialog opens over the list: the list reads React Router's location, so it renders, and its
  // read's key holds `page` alone, so nothing is read.
  await go({ page: 1, view: 7 });
  expect(rendered.get('components/list')).toBeGreaterThan(0);
  expect(reads).toEqual([1]);

  await go({ page: 2, view: 7 });
  expect(container.textContent).toBe('page 2');
  expect(reads).toEqual([1, 2]);
});

test('a folder whose chart alone reads the route calls no hook of the router: a change of address does not render it', async () => {
  const Editor = component({
    path: 'components/editor',
    reads: { state: ['route'] },
    skins: {},
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
  expect(rendered.get('components/editor')).toBeUndefined();
});

test('a view whose files read the route renders at each change of address, and what it wires reads the route of its render', async () => {
  const pressed: unknown[] = [];
  const renders: unknown[] = [];
  const Button = component({
    path: 'components/sell',
    reads: { view: ['route'] },
    skins: {},
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

  // A field it does not read: the folder renders, since it reads the router's location.
  await go({ page: 2 });
  expect(rendered.get('components/sell')).toBeGreaterThan(0);
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
    view: module({
      render: ({ route }: { route: Props }) => createElement('i', null, `page ${String(route['page'])}`),
    }),
  });
  const { container, go } = await at({ page: 1 }, createElement(Crumb));
  expect(container.textContent).toBe('page 1');

  await go({ edit: 4, page: 2 });
  expect(container.textContent).toBe('page 2');
});
