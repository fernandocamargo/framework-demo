import { act, render } from '@testing-library/react';
import { useSelector } from '@xstate/react';
import { Activity, createElement, type ReactNode, StrictMode, Suspense, useCallback, useMemo } from 'react';

// @ts-expect-error The plugin is plain JavaScript, with no declarations.
import { handlersModule } from '../../plugin/index.mjs';
import { isBusy, whenIdle } from '../activity';
import { useOperation } from '../async';
import { bound } from '../boundaries';
import { component } from '../component';
import { createDataLayer, createQueryClient } from '../data';
import { type DataEvent, type Failure, type Interaction, onData, onFailure, pipeline, type Scope } from '../pipeline';
import { Root } from '../root';
import { interact } from '../track';
import { wiredOperations } from './operations.cases';
import { routed, useTestRoute } from './routed';

// No app here: the plugin's modules of clients and services are empty.
vi.mock('virtual:framework/clients', () => ({ default: {}, env: {} }));
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
  layers: {
    async?: object;
    form?: object;
    props?: { default: (given: Props) => Props };
    state?: object;
  } = {},
  show: (props: Props) => ReactNode = () => null,
) {
  const seen: Handlers[] = [];
  const Component = component({
    path,
    reads: {
      view: [...['route', 'acl', 'flags'].filter((name) => source.includes(name)), ...(layers.async ? ['async'] : [])],
    },
    skins: {},
    // A folder with an async.ts here has a render that reads `async`.
    useRoute: useTestRoute,
    view: () =>
      Promise.resolve({
        ...wiredOperations({ names: Object.keys(layers.async ?? {}), status: { save: ['pending', 'data'] } }),
        async: layers.async as never,
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

test.each(['cancel', 'succeed', 'fail'] as const)(
  'a hidden operation can %s through the service and tracked handler without replay on reveal',
  async (outcome) => {
    const client = createQueryClient();
    const data = createDataLayer(client, { id: 'shop' });
    const failures: Failure[] = [];
    const events: DataEvent[] = [];
    const offFailure = onFailure((failure) => failures.push(failure));
    const offData = onData((event) => events.push(event));

    const reason =
      outcome === 'cancel' ? new DOMException('The operation was aborted.', 'AbortError') : new Error('server refused');

    let calls = 0;
    let signal!: AbortSignal;
    let finish!: () => void;

    const service = (given: AbortSignal) => {
      calls++;
      signal = given;

      return new Promise<number>((resolve, reject) => {
        finish = () => (outcome === 'succeed' ? resolve(7) : reject(reason));

        if (outcome === 'cancel') given.addEventListener('abort', finish, { once: true });
      });
    };

    const injection = { save: (signal: AbortSignal) => data.call('demo.save', () => service(signal), []) };
    const exported = ({ save, signal }: typeof injection & { signal: AbortSignal }) => save(signal);

    const { Component, seen } = folder(
      'components/handler-cancellation',
      'export const store = ({ save }) => () => save();',
      {},
      ({ phase }) => String(phase),
    );

    function Owner() {
      const [save, actor] = useOperation('components/handler-cancellation', 'save', exported, injection);
      const phase = useSelector(actor, (snapshot) => snapshot.value);

      return bound(createElement(Component, { phase, save }));
    }

    const tree = (mode: 'hidden' | 'visible') =>
      createElement(
        StrictMode,
        null,
        createElement(Root, { client, entity }, createElement(Activity, { children: createElement(Owner), mode })),
      );

    const view = await show(tree('visible'));
    let promise!: Promise<unknown>;
    await act(async () => {
      promise = Promise.resolve(seen.at(-1)!.store!());
    });
    expect(calls).toBe(1);
    expect(signal.aborted).toBe(false);
    await view.rerender(tree('hidden'));
    expect(signal.aborted).toBe(true);

    if (outcome !== 'cancel') {
      expect(isBusy()).toBe(true);
      finish();
    }

    const result = await promise.catch((error: Error) => error);
    await view.rerender(tree('visible'));
    await whenIdle();
    offFailure();
    offData();
    expect(calls).toBe(1);
    expect(view.container.textContent).toBe(
      outcome === 'cancel' ? 'idle' : outcome === 'succeed' ? 'fulfilled' : 'rejected',
    );
    expect(result).toBe(outcome === 'succeed' ? 7 : reason);
    expect(events.flatMap((event) => (event.action === 'write' ? [event.outcome] : []))).toEqual([
      'sent',
      outcome === 'cancel' ? 'cancelled' : outcome === 'succeed' ? 'done' : 'failed',
    ]);
    expect(failures).toEqual(outcome === 'fail' ? [expect.objectContaining({ error: reason, layer: 'service' })] : []);
    client.clear();
  },
);

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

test('the palette search sends each text once through its chart handler', async () => {
  const interactions: Interaction[] = [];
  const texts: string[] = [];

  const listen = (event: Event) => {
    if (event instanceof CustomEvent) interactions.push(event.detail);
  };

  const { Component, seen } = folder(
    'components/palette/components/search',
    'export const type = ({ state }) => (text) => state.send({ text, type: "typed" });',
    {
      state: {
        default: () => ({
          idle: { on: { typed: { actions: ({ event }: { event: { text: string } }) => texts.push(event.text) } } },
        }),
      },
    },
  );

  const client = createQueryClient();
  pipeline.addEventListener('interaction', listen);

  try {
    await show(createElement(Root, { client, entity }, createElement(Component)));
    seen.at(-1)!.type!('lamp');
    seen.at(-1)!.type!('desk');
    await settle();
    expect(texts).toEqual(['lamp', 'desk']);
    expect(interactions.map(({ name }) => name)).toEqual([
      'components/palette/components/search#handlers.type',
      'components/palette/components/search#handlers.type',
    ]);
  } finally {
    pipeline.removeEventListener('interaction', listen);
  }
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

test("a handler that calls an operation keeps its identity while the operation runs, and the render shows the operation's state", async () => {
  let answer: ((value: unknown) => void) | undefined;
  const { Component, seen } = folder(
    'components/handler-operation',
    'export const store = ({ async }) => () => async.save();',
    { async: { save: () => new Promise((resolve) => (answer = resolve)) } },
    // No props.ts: the render reads the selected status.
    ({ status }) => {
      // SAFETY: The generated fixture selects these two save fields.
      const { save } = status as { save: { data: unknown; pending: boolean } };
      return save.pending ? 'saving' : String(save.data ?? 'idle');
    },
  );
  const { container } = await show(
    createElement(Root, { client: createQueryClient(), entity }, createElement(Component)),
  );
  const handlers = seen.at(-1)!;
  expect(container.textContent).toBe('idle');

  await act(async () => void handlers.store!());
  expect(container.textContent).toBe('saving');
  await act(async () => answer?.('saved'));
  await settle();
  expect(container.textContent).toBe('saved');

  // The render ran for each state, and was given the same handlers each time.
  expect(seen.length).toBe(3);
  for (const each of seen) expect(each).toBe(handlers);
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
  await show(createElement(Root, { client: createQueryClient(), entity }, createElement(Component, { record })));
  const handlers = seen.at(-1)!;
  handlers.submit!();
  await act(async () => void handlers.rename!('typed'));
  await settle();
  handlers.submit!();
  expect(recorded).toEqual(['untitled', 'typed']);
  // Nothing the render or a handler follows changed: the component did not render again.
  expect(seen.length).toBe(1);
});

test('a handler that reads a field of the route is a new function for that field, and for no other', async () => {
  const recorded: unknown[] = [];
  const record = (value: unknown) => recorded.push(value);
  const { Component, seen } = folder(
    'components/handler-route',
    'export const keep = ({ record, route }) => () => record(route.page);',
  );
  const client = createQueryClient();

  const page = routed({ page: 0, q: '' }, { page: 1, q: 'a' }, () =>
    createElement(Root, { client, entity }, createElement(Component, { record })),
  );
  await show(page.element);
  // Another field: the folder renders with the router's new location, and the handler is the same function.
  await page.go({ page: 1, q: 'b' });
  expect(seen.at(-1)!.keep).toBe(seen[0]!.keep);
  await page.go({ page: 2, q: 'b' });
  expect(seen.at(-1)!.keep).not.toBe(seen[0]!.keep);
  seen[0]!.keep!();
  seen.at(-1)!.keep!();
  expect(recorded).toEqual([1, 2]);
});

test('a handler that passes the whole route to another function receives the current address', async () => {
  const recorded: number[] = [];
  const record = ({ page }: { page: number }) => recorded.push(page);
  const { Component, seen } = folder(
    'components/handler-address',
    'export const keep = ({ record, route }) => () => record(route);',
  );

  const client = createQueryClient();

  const page = routed({ page: 0 }, { page: 1 }, () =>
    createElement(Root, { client, entity }, createElement(Component, { record })),
  );

  await show(page.element);
  await page.go({ page: 2 });
  seen.at(-1)!.keep!();
  expect(recorded).toEqual([2]);
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
    await show(createElement(Root, { client: createQueryClient(), entity }, createElement(Component)));
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
      show(
        createElement(
          Root,
          { client: createQueryClient(), entity },
          createElement(Component, source === 'passed' ? { handlers: {} } : {}),
        ),
      ),
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
  await show(createElement(Root, { client: createQueryClient(), entity }, createElement(Plain, { label: 'plain' })));
  expect(seen[0]).toHaveProperty('label', 'plain');
  expect(seen[0]).not.toHaveProperty('handlers');
});
