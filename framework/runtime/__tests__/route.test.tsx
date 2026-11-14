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
      const view = type !== null && (type.name === 'StatefulView' || type.name === 'StatelessView');
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

test('a component with a default read follows only the route fields its read used: another field does not render it at all', async () => {
  const List = component({
    path: 'components/list',
    skins: {},
    view: module({
      async: { default: ({ route }: { route: Props }) => Promise.resolve({ page: route['page'] }) },
      render: (props: Props) =>
        createElement('p', null, `page ${(props['async'] as { default: { page: number } }).default.page}`),
    }),
  });
  const client = createQueryClient();
  const tree = createElement(List);
  const page = (route: Props) => createElement(Root, { client, entity, route: route as never }, tree);
  const { container, rerender } = await show(page({ page: 1, view: null }));
  expect(container.textContent).toBe('page 1');
  rendered.clear();

  // A dialog opens over the list.
  await rerender(page({ page: 1, view: 7 }));
  expect(rendered.get('components/list')).toBeUndefined();

  await rerender(page({ page: 2, view: 7 }));
  expect(container.textContent).toBe('page 2');
  expect(rendered.get('components/list')).toBeGreaterThan(0);
});

test('a chart reads the route field by field: after its first commit, a change of a field it did not read does not render it', async () => {
  const Editor = component({
    path: 'components/editor',
    skins: {},
    view: module({
      render: (props: Props) =>
        createElement('p', null, String((props['state'] as { context: { id: unknown } }).context.id)),
      state: { context: ({ route }: { route: Props }) => ({ id: route['edit'] }), default: { editing: {} } },
    }),
  });
  const client = createQueryClient();
  const tree = createElement(Editor);
  const page = (route: Props) => createElement(Root, { client, entity, route: route as never }, tree);
  const { container, rerender } = await show(page({ edit: 4, q: 'lamp' }));
  expect(container.textContent).toBe('4');
  rendered.clear();

  await rerender(page({ edit: 4, q: 'desk' }));
  expect(rendered.get('components/editor')).toBeUndefined();
});

test('a view follows the route fields its files read: another field does not render it, and a handler reads the committed route', async () => {
  const pressed: unknown[] = [];
  const Button = component({
    path: 'components/sell',
    reads: { view: ['route'] },
    skins: {},
    view: module({
      props: {
        default: ({ route }: { route: Props }) => ({
          edit: () => pressed.push(route['edit']),
          editing: route['edit'] !== null,
        }),
      },
      render: (props: Props) =>
        createElement('button', { onClick: props['edit'] as () => void }, props['editing'] ? 'on' : 'off'),
    }),
  });
  const client = createQueryClient();
  const tree = createElement(Button);
  const page = (route: Props) => createElement(Root, { client, entity, route: route as never }, tree);
  const { container, rerender } = await show(page({ edit: null, page: 1 }));
  expect(container.textContent).toBe('off');
  rendered.clear();

  await rerender(page({ edit: null, page: 2 }));
  expect(rendered.get('components/sell')).toBeUndefined();

  await rerender(page({ edit: 4, page: 2 }));
  expect(container.textContent).toBe('on');
  expect(rendered.get('components/sell')).toBeGreaterThan(0);

  // Outside the render, the view reads the route React committed.
  await act(async () => container.querySelector('button')!.click());
  expect(pressed).toEqual([4]);
});

test('a view that spreads the route follows all of it', async () => {
  const Link = component({
    path: 'components/address',
    reads: { view: ['route'] },
    skins: {},
    view: module({
      props: { default: ({ route }: { route: Props }) => ({ text: JSON.stringify({ ...route }) }) },
      render: (props: Props) => createElement('a', null, props['text'] as string),
    }),
  });
  const client = createQueryClient();
  const tree = createElement(Link);
  const page = (route: Props) => createElement(Root, { client, entity, route: route as never }, tree);
  const { container, rerender } = await show(page({ edit: null, page: 1 }));
  rendered.clear();
  await rerender(page({ edit: null, page: 2 }));
  expect(container.textContent).toBe('{"edit":null,"page":2}');
  expect(rendered.get('components/address')).toBeGreaterThan(0);
});

test('a failed read shows the error file until the address it read moves on: a new value of a field it followed reads again', async () => {
  const List = component({
    error: () => createElement('p', null, 'failed'),
    path: 'components/failing',
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
  const client = createQueryClient();
  const tree = createElement(List);
  const page = (route: Props) => createElement(Root, { client, entity, route: route as never }, tree);
  const silenced = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const { container, rerender } = await show(page({ page: 3 }));
  expect(container.textContent).toBe('failed');

  await rerender(page({ page: 1 }));
  expect(container.textContent).toBe('page 1');
  silenced.mockRestore();
});
