import { act, render } from '@testing-library/react';
import { createElement, type ReactNode, Suspense, useCallback, useMemo } from 'react';

// @ts-expect-error The plugin is plain JavaScript, with no declarations.
import { handlersModule } from '../../plugin/index.mjs';
import { component } from '../component';
import { createQueryClient } from '../data';
import { type Failure, type Interaction, onFailure, pipeline, type Scope } from '../pipeline';
import { Root } from '../root';
import { interact } from '../track';

// No app here: the plugin's modules of clients and services are empty.
vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type Props = Record<string, unknown>;
type Handlers = Record<string, (...args: unknown[]) => unknown>;

/**
 * A handlers.ts, wired as the plugin wires it: the module it writes from the source, run with the
 * source's exports in place of its imports.
 */
function wired(path: string, source: string) {
  const exported = {};
  new Function('exports', source.replace(/export const (\w+) =/g, 'exports.$1 ='))(exported);
  const code = handlersModule(source, `/src/${path}/handlers.ts`, {
    path,
    relative: `${path}/handlers.ts`,
    runtime: '"framework"',
  }) as string;
  const body = code
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .join('\n')
    .replace(/^export /gm, '');
  return new Function(
    'useCallback',
    'useMemo',
    'interact',
    'exported',
    `${body}\nreturn { route, shape, useHandlers };`,
  )(useCallback, useMemo, interact, exported) as {
    route?: 'fields' | 'whole';
    shape: string;
    useHandlers: (given: Props, scope: Scope) => Props;
  };
}

/** A component whose folder has that handlers.ts, and each `handlers` its render was given. */
function folder(
  path: string,
  source: string,
  layers: { form?: object; props?: { default: (given: Props) => Props }; state?: object } = {},
  show: (props: Props) => ReactNode = () => null,
) {
  const seen: Handlers[] = [];
  const Component = component({
    path,
    reads: { view: ['route', 'acl', 'flags'].filter((name) => source.includes(name)) },
    skins: {},
    view: () =>
      Promise.resolve({
        async: undefined,
        children: [],
        form: layers.form as never,
        handlers: wired(path, source),
        props: layers.props,
        render: (props: Props) => {
          seen.push(props.handlers as Handlers);
          return show(props);
        },
        state: layers.state as never,
      }),
  });
  return { Component, seen };
}

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
const entity = { id: 'shop' } as never;

test('a handler is the same function while what it reads is the same, and a new one when it changes', async () => {
  const recorded: unknown[] = [];
  const record = (value: unknown) => recorded.push(value);
  const { Component, seen } = folder(
    'components/handler',
    `
export const advance = ({ state }) => (event) => state.send({ type: 'advance', amount: event.amount });
export const keep = ({ record, value }) => () => record(value);`,
    { state: { default: { idle: { on: { advance: 'advanced' } }, advanced: {} } } },
    ({ state }) => ((state as { advanced: boolean }).advanced ? 'advanced' : 'idle'),
  );
  const client = createQueryClient();
  const page = (props: Props) =>
    createElement(Root, { client, entity }, createElement(Component, { record, ...props }));
  const { container, rerender } = await show(page({ unused: 1, value: 'first' }));
  const first = seen.at(-1)!;

  // A prop no handler reads: another render, the same functions, the same object.
  await rerender(page({ unused: 2, value: 'first' }));
  expect(seen.length).toBe(2);
  expect(seen.at(-1)).toBe(first);

  // A prop one handler reads: that handler is a new function, the other is not.
  await rerender(page({ unused: 2, value: 'second' }));
  const second = seen.at(-1)!;
  expect(second).not.toBe(first);
  expect(second.keep).not.toBe(first.keep);
  expect(second.advance).toBe(first.advance);

  // The chart moves: its `send` is the same, so is the handler that reads only that.
  await act(async () => void second.advance!({ amount: 1 }));
  await settle();
  expect(container.textContent).toBe('advanced');
  expect(seen.at(-1)).toBe(second);

  first.keep!();
  second.keep!();
  expect(recorded).toEqual(['first', 'second']);
});

test("a callback of a render React threw away never reaches the page: the page's handler reads what its render had", async () => {
  const recorded: unknown[] = [];
  const record = (value: unknown) => recorded.push(value);
  const never = new Promise(() => {});
  const { Component, seen } = folder(
    'components/handler-discarded',
    'export const keep = ({ record, value }) => () => record(value);',
    {},
    ({ handlers, value }) => {
      if (value === 'discarded') throw never;
      return createElement('button', { onClick: (handlers as Handlers).keep }, String(value));
    },
  );
  const client = createQueryClient();
  const page = (value: string) =>
    createElement(
      Root,
      { client, entity },
      createElement(Suspense, { fallback: 'waiting' }, createElement(Component, { record, value })),
    );
  const { container, rerender } = await show(page('first'));
  const button = () => container.querySelector('button')!;
  // This render suspends: React made its callback, and throws it away with the render.
  await rerender(page('discarded'));
  expect(seen.at(-1)!.keep).not.toBe(seen[0]!.keep);
  await act(async () => button().click());
  expect(recorded).toEqual(['first']);
  await rerender(page('second'));
  await act(async () => button().click());
  expect(recorded).toEqual(['first', 'second']);
});

test("a handler reads the form's store when it runs, and typing gives it no new function", async () => {
  const recorded: unknown[] = [];
  const record = (value: unknown) => recorded.push(value);
  const { Component, seen } = folder(
    'components/handler-form',
    `
export const rename = ({ form }) => (value) => form.set('title', value);
export const submit = ({ form, record }) => () => record(form.values.title);`,
    { form: { seed: () => ({ title: 'untitled' }) } },
  );
  await show(createElement(Root, { entity }, createElement(Component, { record })));
  const handlers = seen.at(-1)!;
  handlers.submit!();
  await act(async () => void handlers.rename!('typed'));
  await settle();
  handlers.submit!();
  expect(recorded).toEqual(['untitled', 'typed']);
  // Nothing the render or a handler follows changed: the component did not render again.
  expect(seen.length).toBe(1);
});

test('a handler that reads a field of the route follows that field, and no other', async () => {
  const recorded: unknown[] = [];
  const record = (value: unknown) => recorded.push(value);
  const { Component, seen } = folder(
    'components/handler-route',
    'export const keep = ({ record, route }) => () => record(route.page);',
  );
  const client = createQueryClient();
  const page = (route: Props) =>
    createElement(Root, { client, entity, route: route as never }, createElement(Component, { record }));
  const { rerender } = await show(page({ page: 1, query: 'a' }));
  await rerender(page({ page: 1, query: 'b' }));
  expect(seen.length).toBe(1);
  await rerender(page({ page: 2, query: 'b' }));
  expect(seen.at(-1)!.keep).not.toBe(seen[0]!.keep);
  seen[0]!.keep!();
  seen.at(-1)!.keep!();
  expect(recorded).toEqual([1, 2]);
});

test('a handler emits its interaction, and its failure is reported in the handler layer with its export as the site', async () => {
  const failures: Failure[] = [];
  const interactions: Interaction[] = [];
  const stop = onFailure((failure) => failures.push(failure));
  const listen = (event: Event) => interactions.push((event as CustomEvent<Interaction>).detail);
  pipeline.addEventListener('interaction', listen);
  const { Component, seen } = folder(
    'components/handler-failing',
    "export const fail = () => () => { throw new Error('failed'); };",
  );
  try {
    await show(createElement(Root, { entity }, createElement(Component)));
    expect(() => seen[0]!.fail!()).toThrow('failed');
    await settle();
    expect(interactions).toEqual([
      expect.objectContaining({
        chain: ['components/handler-failing'],
        name: 'components/handler-failing#handlers.fail',
      }),
    ]);
    expect(failures).toEqual([
      expect.objectContaining({
        chain: ['components/handler-failing'],
        layer: 'handler',
        path: 'components/handler-failing',
        site: expect.objectContaining({ handler: 'handlers.fail', prop: 'fail' }),
      }),
    ]);
  } finally {
    stop();
    pipeline.removeEventListener('interaction', listen);
  }
});

test.each(['passed', 'shaped'])('the handlers prop is reserved when it is %s', async (source) => {
  const { Component } = folder(`components/collision-${source}`, 'export const act = () => () => {};', {
    props: source === 'shaped' ? { default: () => ({ handlers: 'already here' }) } : undefined,
  });
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await expect(
      show(createElement(Root, { entity }, createElement(Component, source === 'passed' ? { handlers: {} } : {}))),
    ).rejects.toThrow(/handlers is reserved for handlers\.ts/);
  } finally {
    errors.mockRestore();
  }
});

test('a folder without handlers.ts gets no handlers prop', async () => {
  const seen: Props[] = [];
  const Plain = component({
    path: 'components/no-handlers',
    skins: {},
    view: () =>
      Promise.resolve({
        async: undefined,
        children: [],
        form: undefined,
        props: undefined,
        render: (props: Props) => {
          seen.push(props);
          return null;
        },
        state: undefined,
      }),
  });
  await show(createElement(Root, { entity }, createElement(Plain, { label: 'plain' })));
  expect(seen[0]).toHaveProperty('label', 'plain');
  expect(seen[0]).not.toHaveProperty('handlers');
});
