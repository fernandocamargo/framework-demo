// Under the dev server, an edit to a file of a component's view sends the view again, and the
// plugin's module for the folder gives it to the component (`replace`). Vitest runs the runtime as
// the dev server does, so these tests hold what an author then sees.

import { act, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { component } from '../component';
import { createQueryClient } from '../data';
import { Root } from '../root';
import type { Operation } from '../types';
import { wiredOperations } from './operations.cases';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type Props = Record<string, unknown>;
type State = { context: { count: number }; send: (event: { type: string }) => void } & Record<string, unknown>;
type Hot = { replace: (module: unknown) => void };
const entity = { id: 'shop' } as never;
const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
async function show(element: ReactNode) {
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(createElement(Root, { client: createQueryClient(), entity }, element));
  });
  await settle();
  return shown!.container;
}

test('unchanged dev renders keep the edit subscription until the instance or type leaves', async () => {
  const files = {
    async: undefined,
    form: undefined,
    props: undefined,
    render: () => createElement('i', null, 'original'),
    state: undefined,
  };

  const spec = { path: 'components/edit-listeners', skins: {}, view: () => Promise.resolve(files) };
  // SAFETY: This test runs the dev runtime, which adds replace to each component type.
  const Watched = component(spec) as Hot & ReturnType<typeof component>;
  const client = createQueryClient();

  const page = (Type: typeof Watched, round: number, two = true) =>
    createElement(
      Root,
      { client, entity },
      createElement(Type, { key: 'first', round }),
      two && createElement(Type, { key: 'second', round }),
    );

  const shown = await act(async () => render(page(Watched, 0)));
  await settle();

  const add = vi.spyOn(Set.prototype, 'add');
  const remove = vi.spyOn(Set.prototype, 'delete');
  const notify = vi.spyOn(Set.prototype, Symbol.iterator);

  try {
    const before = notify.mock.contexts.length;
    let edited = 0;
    await act(async () => {
      Watched.replace({
        ...files,
        render: () => {
          edited++;

          return createElement('i', null, 'edited');
        },
      });
    });
    await settle();
    const listeners = notify.mock.contexts[before];

    if (!(listeners instanceof Set)) throw new Error('Edit listeners were not observed');
    expect(listeners.size).toBe(2);
    expect(shown.container.textContent).toBe('editededited');
    expect(edited).toBe(2);
    add.mockClear();
    remove.mockClear();

    await act(async () => shown.rerender(page(Watched, 1)));
    await settle();
    expect([
      add.mock.contexts.filter((set) => set === listeners).length,
      remove.mock.contexts.filter((set) => set === listeners).length,
    ]).toEqual([0, 0]);

    let again = 0;
    await act(async () =>
      Watched.replace({
        ...files,
        render: () => {
          again++;

          return createElement('i', null, 'again');
        },
      }),
    );
    await settle();
    expect(shown.container.textContent).toBe('againagain');
    expect(listeners.size).toBe(2);
    expect(again).toBe(2);

    await act(async () => shown.rerender(page(Watched, 1, false)));
    await settle();
    expect(listeners.size).toBe(1);
    expect(remove.mock.contexts.filter((set) => set === listeners)).toHaveLength(1);

    // SAFETY: The replacement type is created under the same dev runtime.
    const Replacement = component(spec) as Hot & ReturnType<typeof component>;
    await act(async () => shown.rerender(page(Replacement, 1, false)));
    await settle();
    expect(listeners.size).toBe(0);
    await act(async () => Replacement.replace({ ...files, render: () => createElement('i', null, 'replacement') }));
    await settle();
    expect(shown.container.textContent).toBe('replacement');
  } finally {
    add.mockRestore();
    remove.mockRestore();
    notify.mockRestore();
  }
});

test('an edited render shows in the instance on screen, which keeps its chart where it was and what was typed', async () => {
  let state: State | undefined;
  const chart = {
    context: () => ({ count: 0 }),
    counted: ({ context }: { context: { count: number } }) => ({ count: context.count + 1 }),
    default: {} as Record<string, unknown>,
  };
  chart.default = { closed: { on: { open: { actions: chart.counted, target: 'open' } } }, open: {} };
  const files = {
    async: undefined,
    children: [],
    form: { seed: () => ({ title: '' }) },
    props: undefined,
    render: (props: Props) => {
      state = props['state'] as State;
      return createElement(
        'p',
        null,
        createElement('input', { defaultValue: (props['form'] as { initial: { title: string } }).initial.title }),
        state['open'] ? 'open' : 'closed',
      );
    },
    state: chart,
  };
  const Dialog = component({
    path: 'components/dialog',
    reads: { state: [] },
    skins: {},
    view: () => Promise.resolve(files) as never,
  });
  const container = await show(createElement(Dialog));
  await act(async () => state!.send({ type: 'open' }));
  await settle();
  const field = container.querySelector('input')!;
  field.value = 'typed';
  expect(container.textContent).toBe('open');

  // The render is edited: other markup around the same field.
  await act(async () =>
    (Dialog as unknown as Hot).replace({
      ...files,
      render: (props: Props) => {
        state = props['state'] as State;
        return createElement(
          'p',
          null,
          createElement('input', { defaultValue: (props['form'] as { initial: { title: string } }).initial.title }),
          state['open'] ? `edited, open, counted ${state.context.count}` : 'edited, closed',
        );
      },
    }),
  );
  await settle();
  expect(container.textContent).toBe('edited, open, counted 1');
  expect(container.querySelector('input')).toBe(field);
  expect(field.value).toBe('typed');
});

test('an edit that gives the view a default read mounts it again, with no change of hooks in an instance', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const files = {
    async: undefined,
    children: [],
    form: undefined,
    props: undefined,
    render: () => createElement('p', null, 'no read'),
    state: undefined,
  };
  const Listed = component({ path: 'components/listed', skins: {}, view: () => Promise.resolve(files) as never });
  const container = await show(createElement(Listed));
  expect(container.textContent).toBe('no read');

  await act(async () =>
    (Listed as unknown as Hot).replace({
      ...files,
      async: { default: () => Promise.resolve('answer') },
      render: ({ async }: Props) => createElement('p', null, String((async as { default: unknown }).default)),
    }),
  );
  await settle();
  expect(container.textContent).toBe('answer');
  expect(errors.mock.calls.map((call) => String(call[0]))).toEqual([]);
  errors.mockRestore();
});

test('adding or removing a form mounts the view again with the new layer', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const files = {
    async: undefined,
    form: undefined,
    props: undefined,
    render: ({ form }: Props) =>
      createElement('input', { defaultValue: (form as undefined | { initial: { title: string } })?.initial.title }),
    state: undefined,
  };
  const Field = component({ path: 'components/field', skins: {}, view: () => Promise.resolve(files) });
  const container = await show(createElement(Field));
  const first = container.querySelector('input')!;
  first.value = 'typed';

  await act(async () => (Field as unknown as Hot).replace({ ...files, form: { seed: () => ({ title: 'seeded' }) } }));
  await settle();
  const seeded = container.querySelector('input')!;
  expect(seeded).not.toBe(first);
  expect(seeded.value).toBe('seeded');

  await act(async () => (Field as unknown as Hot).replace(files));
  await settle();
  expect(container.querySelector('input')).not.toBe(seeded);
  expect(container.querySelector('input')!.value).toBe('');
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
});

test.each([false, true])(
  'adding and removing the last operation remounts and aborts it (default read: %s)',
  async (read) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let operation: Operation | undefined;
    let status: undefined | { pending: boolean };
    let signal: AbortSignal | undefined;
    let finish: (answer: string) => void = () => undefined;
    const files = {
      async: read ? { default: () => Promise.resolve('answer') } : undefined,
      form: undefined,
      props: undefined,
      render: ({ async, status: selected }: Props) => {
        // SAFETY: The generated fixture selects save.pending when the operation exists.
        status = (selected as undefined | { save?: { pending: boolean } })?.save;
        const layer = async as undefined | { default?: string; save?: Operation };
        operation = layer?.save;
        return createElement('input', { defaultValue: layer?.default ?? 'no read' });
      },
      state: undefined,
    };
    const Editor = component({ path: 'components/operation-edit', skins: {}, view: () => Promise.resolve(files) });
    const container = await show(createElement(Editor));
    const first = container.querySelector('input')!;
    const withOperation = {
      ...files,
      ...wiredOperations({ names: ['save'], status: { save: ['pending'] } }),
      async: {
        ...files.async,
        save: (given: { signal: AbortSignal }) => {
          signal = given.signal;
          return new Promise<string>((resolve) => (finish = resolve));
        },
      },
    };
    await act(async () => (Editor as unknown as Hot).replace(withOperation));
    await settle();
    const active = container.querySelector('input')!;
    expect(active).not.toBe(first);
    expect(active.value).toBe(read ? 'answer' : 'no read');
    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = operation!();
    });
    expect(status!.pending).toBe(true);
    expect(signal?.aborted).toBe(false);

    // A render edit with the same layers keeps the field and the operation in flight.
    active.value = 'typed';
    await act(async () =>
      (Editor as unknown as Hot).replace({ ...withOperation, render: (props: Props) => files.render(props) }),
    );
    await settle();
    expect(container.querySelector('input')).toBe(active);
    expect(active.value).toBe('typed');
    expect(status!.pending).toBe(true);
    expect(signal?.aborted).toBe(false);

    await act(async () => (Editor as unknown as Hot).replace(files));
    await settle();
    expect(container.querySelector('input')).not.toBe(active);
    expect(operation).toBeUndefined();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      finish('saved');
      await expect(pending).resolves.toBe('saved');
    });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  },
);

test('adding or removing an export or selector remounts a view that already owns operations', async () => {
  let save: Operation | undefined;
  let signal: AbortSignal | undefined;
  let finish!: (value: string) => void;

  const files = {
    ...wiredOperations({ names: ['save'], status: { save: [] } }),
    async: {
      save: ({ signal: current }: { signal: AbortSignal }) => {
        signal = current;

        return new Promise<string>((resolve) => (finish = resolve));
      },
    },
    form: undefined,
    props: undefined,
    render: ({ async }: Props) => {
      // SAFETY: The fixture declares save as its named command.
      save = (async as { save: Operation }).save;

      return createElement('input');
    },
    state: undefined,
  };

  const Editor = component({ path: 'components/operation-shape-edit', skins: {}, view: () => Promise.resolve(files) });
  // SAFETY: These cases run the dev runtime, which exposes replace on the component type.
  const HotEditor = Editor as Hot & typeof Editor;
  const container = await show(createElement(Editor));

  const manifests: Parameters<typeof wiredOperations>[0][] = [
    { names: ['erase', 'save'], status: { erase: [], save: [] } },
    { names: ['save'], status: { save: [] } },
    { names: ['save'], status: { save: ['pending'] } },
    { names: ['save'], status: { save: [] } },
  ];

  for (const manifest of manifests) {
    const before = container.querySelector('input');
    const pending = save!();
    const running = signal!;
    await act(async () =>
      HotEditor.replace({
        ...files,
        ...wiredOperations(manifest),
        async: { ...files.async, erase: () => Promise.resolve() },
      }),
    );
    await settle();
    expect(container.querySelector('input')).not.toBe(before);
    expect(running.aborted).toBe(true);
    await act(async () => {
      finish('saved');
      await pending;
    });
  }
});

test('an ordinary export edit keeps the actor and running implementation; new calls use the edited export', async () => {
  let save!: Operation<string>;
  let signal!: AbortSignal;
  let finish!: (value: string) => void;

  const files = {
    ...wiredOperations({ names: ['save'], status: { save: [] } }),
    async: {
      save: ({ signal: current }: { signal: AbortSignal }) => {
        signal = current;

        return new Promise<string>((resolve) => (finish = resolve));
      },
    },
    form: undefined,
    props: undefined,
    render: ({ async }: Props) => {
      // SAFETY: The fixture declares save as its named command.
      save = (async as { save: typeof save }).save;

      return createElement('input');
    },
    state: undefined,
  };

  const Editor = component({
    path: 'components/operation-implementation-edit',
    skins: {},
    view: () => Promise.resolve(files),
  });

  // SAFETY: These cases run the dev runtime, which exposes replace on the component type.
  const HotEditor = Editor as Hot & typeof Editor;
  const container = await show(createElement(Editor));
  const field = container.querySelector('input');
  const before = save;
  const pending = save();
  await act(async () => HotEditor.replace({ ...files, async: { save: () => Promise.resolve('edited') } }));
  await settle();
  expect(container.querySelector('input')).toBe(field);
  expect(signal.aborted).toBe(false);
  expect(save).not.toBe(before);
  await act(async () => {
    finish('original');
    await expect(pending).resolves.toBe('original');
    await expect(save()).resolves.toBe('edited');
  });
});

test("the plugin's module for a folder takes an edit to its view or a skin under the dev server, and not in a build", async () => {
  const { mkdirSync, mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  // @ts-expect-error The plugin is plain JavaScript, with no declarations.
  const { default: framework } = await import('../../plugin/index.mjs');
  const cwd = mkdtempSync(path.join(tmpdir(), 'framework-hot-'));
  const dir = path.join(cwd, 'src/components/card');
  mkdirSync(path.join(dir, 'style/skins/default'), { recursive: true });
  writeFileSync(path.join(dir, 'render.tsx'), 'export default () => <p />;\n');
  writeFileSync(path.join(dir, 'state.ts'), 'export default { idle: {} };\n');
  writeFileSync(path.join(dir, 'style/skins/default/index.ts'), 'export default ``;\n');
  mkdirSync(path.join(dir, 'i18n'), { recursive: true });
  writeFileSync(path.join(dir, 'i18n.ts'), "export default { title: 'Card' };\n");
  writeFileSync(path.join(dir, 'i18n/pt-BR.json'), '{"components/card/title":"Cartão"}\n');
  const other = path.join(cwd, 'src/components/other');
  mkdirSync(other, { recursive: true });
  writeFileSync(path.join(other, 'render.tsx'), 'export default () => <p />;\n');
  writeFileSync(path.join(other, 'i18n.ts'), "export default { title: 'Other' };\n");
  const load = (command: 'build' | 'serve', id: string) => {
    const plugin = framework({ cwd, root: 'src', runtime: 'runtime.ts' }) as unknown as {
      configResolved: (config: { command: string }) => void;
      load: (this: { addWatchFile: () => void }, id: string) => string;
    };
    plugin.configResolved({ command });
    return plugin.load.call({ addWatchFile: () => undefined }, id);
  };
  const folder = `\0framework-component:${dir}`;
  const served = load('serve', folder);
  expect(served).toContain(`import.meta.hot.accept(${JSON.stringify(`framework-view:${dir}`)}, (view) =>`);
  expect(served).toContain(
    `import.meta.hot.accept(${JSON.stringify(path.join(dir, 'style/skins/default/index.ts'))}, (sheet) =>`,
  );
  expect(load('serve', '\0virtual:framework/charts')).toContain(
    `import.meta.hot.accept(${JSON.stringify(path.join(dir, 'state.ts'))}, (chart) =>`,
  );
  expect(load('build', folder)).not.toContain('import.meta.hot');
  expect(load('build', '\0virtual:framework/charts')).not.toContain('import.meta.hot');
  const allMessages = load('build', '\0virtual:framework/messages');
  expect(allMessages).toContain('components/card');
  expect(allMessages).toContain('components/other');
  expect(allMessages).toContain('i18n/pt-BR.json');
  expect(allMessages).toContain('preloadMessages(folders, locale)');
});
