import { act, render, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
// No app here: the plugin's modules of clients and services are empty.
import { useLocation } from 'react-router';

import { bound } from '../boundaries';
import { component } from '../component';
import { createQueryClient } from '../data';
import { useFormLayer } from '../form';
import { Root } from '../root';
import { routed, useTestRoute } from './routed';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type Props = Record<string, unknown>;
type Answer = { meta: { asOf: string }; page: number };
const view = (render: (props: Props) => ReactNode, read?: (injection: { route: Props }) => Promise<unknown>) => () =>
  Promise.resolve({
    async: read ? { default: read } : undefined,
    children: [],
    form: undefined,
    props: undefined,
    render,
    state: undefined,
  });
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
// React asks for an awaited `act` around anything that may suspend.
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
// The app declares its own route and entity (src/env.d.ts); these tests use their own.
const entity = { id: 'shop' } as never;
/** `tree` under a Root at `start`, in a memory router; `go` moves the address and lets the page settle. */
async function at(client: ReturnType<typeof createQueryClient>, start: Props, tree: ReactNode) {
  // SAFETY: These synthetic route values are the primitive fields declared by the test.
  const page = routed({ edit: 0, other: '', page: 0 }, start as never, () =>
    createElement(Root, { client, entity }, tree),
  );
  const { container } = await show(page.element);
  return {
    container,
    go: async (route: Props) => {
      await page.go(route as never);
      await settle();
    },
  };
}

test('a change of address renders no component whose files do not read the route', async () => {
  const calls: string[] = [];
  const Plain = component({
    path: 'components/plain',
    skins: {},
    view: view(() => {
      calls.push('plain');
      return createElement('p', null, 'plain');
    }),
  });
  const client = createQueryClient();
  const { container, go } = await at(client, { page: 1 }, createElement(Plain));
  expect(container.textContent).toBe('plain');
  expect(calls).toEqual(['plain']);

  await go({ page: 2 });
  expect(calls).toEqual(['plain']);
  // Nor does it hold a query: a stand-in one would suspend its first render once.
  expect(client.getQueryCache().findAll({ queryKey: ['component', 'components/plain'] })).toHaveLength(0);
});

test.each([false, true])(
  'a child loads before its parent renders unless it has its own placeholder: %s',
  async (placeholder) => {
    let finish!: () => void;

    const loading = new Promise<void>((resolve) => {
      finish = resolve;
    });

    const calls: string[] = [];

    const Child = component({
      path: 'components/loading-child',
      placeholder: placeholder ? () => createElement('p', null, 'loading') : undefined,
      skins: {},
      view: async () => {
        await loading;

        return {
          async: undefined,
          form: undefined,
          props: undefined,
          render: () => createElement('p', null, 'child'),
          state: undefined,
        };
      },
    });

    const Parent = component({
      path: 'components/loading-parent',
      skins: {},
      view: () =>
        Promise.resolve({
          async: undefined,
          children: [Child],
          form: undefined,
          props: undefined,
          render: () => {
            calls.push('parent');

            return bound(createElement(Child));
          },
          state: undefined,
        }),
    });

    const { container } = await show(
      createElement(Root, { client: createQueryClient(), entity }, createElement(Parent)),
    );

    expect(calls).toEqual(placeholder ? ['parent'] : []);
    await act(async () => finish());
    await settle();
    expect(container.textContent).toBe('child');
    expect(calls).toEqual(['parent']);
  },
);

test('a preloaded child waits for its skin and keeps its own import failure', async () => {
  let finish!: (skin: { default: string }) => void;

  const skin = new Promise<{ default: string }>((resolve) => {
    finish = resolve;
  });

  const calls: string[] = [];

  const Child = component({
    error: () => createElement('p', null, 'child failed'),
    path: 'components/failed-child',
    skins: { default: () => skin },
    view: () => Promise.reject(new Error('missing view')),
  });

  const Parent = component({
    error: () => createElement('p', null, 'parent failed'),
    path: 'components/failed-parent',
    skins: {},
    view: () =>
      Promise.resolve({
        async: undefined,
        children: [Child],
        form: undefined,
        props: undefined,
        render: () => {
          calls.push('parent');

          return bound(createElement(Child));
        },
        state: undefined,
      }),
  });

  const silenced = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  try {
    const { container } = await show(
      createElement(Root, { client: createQueryClient(), entity }, createElement(Parent)),
    );

    expect(calls).toEqual([]);
    await act(async () => finish({ default: '' }));
    await settle();
    expect(container.textContent).toBe('child failed');
  } finally {
    silenced.mockRestore();
  }
});

test('a component with a default read reads again, and calls its render, only when the route parameters it read change', async () => {
  const reads: unknown[] = [];
  const renders: unknown[] = [];
  const Reader = component({
    path: 'components/reader',
    reads: { async: ['route'] },
    skins: {},
    useRoute: useTestRoute,
    view: view(
      (props) => {
        const answer = (props['async'] as { default: Answer }).default;
        renders.push(answer.page);
        return createElement('p', null, `page ${answer.page}`);
      },
      ({ route }) => {
        reads.push(route['page']);
        return Promise.resolve({ meta: { asOf: 'monday' }, page: route['page'] });
      },
    ),
  });
  const client = createQueryClient();
  const { container, go } = await at(client, { other: 'a', page: 1 }, createElement(Reader));
  expect(container.textContent).toBe('page 1');

  // A parameter its read never looked at: the same answer, and its render is not called.
  await go({ other: 'b', page: 1 });
  expect(reads).toEqual([1]);
  expect(renders).toEqual([1]);

  await go({ other: 'b', page: 2 });
  expect(container.textContent).toBe('page 2');
  expect(reads).toEqual([1, 2]);
  expect(renders).toEqual([1, 2]);
});

test('a new answer keeps the parts equal to the last one shown, so a child given one keeps its memo', async () => {
  const childRenders: unknown[] = [];
  const Child = component({
    path: 'components/child',
    skins: {},
    view: view((props) => {
      childRenders.push(props['meta']);
      return createElement('span', null, (props['meta'] as Answer['meta']).asOf);
    }),
  });
  const Parent = component({
    path: 'components/parent',
    reads: { async: ['route'] },
    skins: {},
    useRoute: useTestRoute,
    view: view(
      (props) => {
        const answer = (props['async'] as { default: Answer }).default;
        return createElement('div', null, `page ${answer.page} `, createElement(Child, { meta: answer.meta }));
      },
      ({ route }) => Promise.resolve({ meta: { asOf: 'monday' }, page: route['page'] }),
    ),
  });
  const client = createQueryClient();
  const { container, go } = await at(client, { page: 1 }, createElement(Parent));
  expect(container.textContent).toBe('page 1 monday');

  // Another page has its own query, and its answer is a new object; its equal `meta` is the old one.
  await go({ page: 2 });
  expect(container.textContent).toBe('page 2 monday');
  expect(childRenders).toHaveLength(1);
});

test('the form renders its component only for the values it read, and for a seed; set and seed stay the same functions', () => {
  const module = {
    seed: (data?: { city: string; name: string }) => ({ city: data?.city ?? '', name: data?.name ?? '' }),
  };
  let renders = 0;
  const { result } = renderHook(() => {
    renders++;
    return useFormLayer(module);
  });
  const { seed, set } = result.current.view;
  // Nothing read yet: a value changes, and the component does not render. The chart sees it.
  act(() => set('name', 'Lisbon'));
  expect(renders).toBe(1);
  expect(result.current.latest.values).toEqual({ city: '', name: 'Lisbon' });
  expect(result.current.latest.unsaved).toBe(true);

  // It reads `city`: a change of `name` still renders nothing; one of `city` does.
  expect(result.current.view.values.city).toBe('');
  act(() => set('name', 'Porto'));
  expect(renders).toBe(1);
  act(() => set('city', 'Faro'));
  expect(renders).toBe(2);
  expect(result.current.view.values.city).toBe('Faro');
  expect(result.current.view.set).toBe(set);

  // A seed renders it, with the values a field starts from.
  act(() => seed({ city: 'Braga', name: 'Ana' }));
  expect(renders).toBe(3);
  expect(result.current.view.initial).toEqual({ city: 'Braga', name: 'Ana' });
  expect(result.current.view.seed).toBe(seed);
  expect(result.current.latest.unsaved).toBe(false);
});

test('a seed that reads the props is seeded again when they change, after the commit', () => {
  // The catalogue's search: its text is the address's, and follows it back.
  const module = { seed: (_: undefined, { q }: { page: number; q: string }) => ({ q }) };
  let renders = 0;
  const { rerender, result } = renderHook(
    (props: { page: number; q: string }) => {
      renders++;
      return useFormLayer(module, undefined, props);
    },
    { initialProps: { page: 1, q: 'lamp' } },
  );
  expect(result.current.view.values.q).toBe('lamp');
  expect(result.current.latest.unsaved).toBe(false);

  // What is typed stays while a prop the seed did not read changes.
  act(() => result.current.view.set('q', 'desk'));
  expect(renders).toBe(2);
  rerender({ page: 2, q: 'lamp' });
  expect(result.current.view.values.q).toBe('desk');
  expect(renders).toBe(3);

  // Its own search: the prop becomes what was typed. The form is seeded again, and the component,
  // which did not read `initial`, does not render for it.
  rerender({ page: 1, q: 'desk' });
  expect(renders).toBe(4);
  expect(result.current.latest.initial).toEqual({ q: 'desk' });
  expect(result.current.latest.unsaved).toBe(false);

  // The back button: the prop goes back, and the field with it.
  act(() => result.current.view.set('q', 'des'));
  rerender({ page: 1, q: 'lamp' });
  expect(result.current.view.values.q).toBe('lamp');
  expect(result.current.latest.unsaved).toBe(false);

  // A seed from the state layer gets the props too.
  const seeded: unknown[] = [];
  const both = {
    seed: (data: undefined | { title: string }, { q }: { q: string }) => {
      seeded.push([data, q]);
      return { q, title: data?.title ?? '' };
    },
  };
  const { result: editor } = renderHook(() => useFormLayer(both, undefined, { q: 'lamp' }));
  act(() => editor.current.latest.seed({ title: 'Desk' }));
  expect(editor.current.latest.values).toEqual({ q: 'lamp', title: 'Desk' });
  expect(seeded).toEqual([
    [undefined, 'lamp'],
    [{ title: 'Desk' }, 'lamp'],
  ]);
});

test('a chart created by a change of route reads that route, not the one before it', async () => {
  const read: unknown[] = [];
  const Editor = component({
    path: 'components/editor',
    reads: { state: ['route'] },
    skins: {},
    useRoute: useTestRoute,
    view: () =>
      Promise.resolve({
        async: undefined,
        children: [],
        form: undefined,
        props: undefined,
        render: (props: Props) =>
          createElement('p', null, String((props['state'] as { context: { id: unknown } }).context.id)),
        state: {
          context: ({ route }: { route: Props }) => {
            read.push(route['edit']);
            return { id: route['edit'] };
          },
          default: { editing: {} },
        },
      }),
  });
  const client = createQueryClient();
  const When = () => (useLocation().search.includes('edit') ? createElement(Editor) : null);
  const { container, go } = await at(client, {}, createElement(When));
  await go({ edit: 4 });
  expect(container.textContent).toBe('4');
  expect(read.every((value) => value === 4)).toBe(true);
});
