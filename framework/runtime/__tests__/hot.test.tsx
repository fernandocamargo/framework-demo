// Under the dev server, an edit to a file of a component's view sends the view again, and the
// plugin's module for the folder gives it to the component (`replace`). Vitest runs the runtime as
// the dev server does, so these tests hold what an author then sees.

import { act, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { component } from '../component';
import { createQueryClient } from '../data';
import { Root } from '../root';

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
});
