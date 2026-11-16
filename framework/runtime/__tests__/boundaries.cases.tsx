// A folder is one component, with no boundary of its own: whoever renders it composes its
// placeholder's `Suspense` and its error boundary around its element (`bound`). A parent's render
// gets that from the plugin, Root does it for the folders it is given, and any other code calls it.
//
// The same cases run twice: as the dev server composes (boundaries.test.tsx: every folder's element
// also follows its edits), and as a build does (boundaries.build.test.tsx).

import { act, fireEvent, render } from '@testing-library/react';
import { createElement, type ReactElement, type ReactNode, Suspense } from 'react';

import { bound } from '../boundaries';
import { component } from '../component';
import { createQueryClient } from '../data';
import { HOT } from '../hot';
import { type Failure, onFailure } from '../pipeline';
import { Root } from '../root';

type Props = Record<string, unknown>;
const entity = { id: 'shop' } as never;
const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
const layers = { async: undefined, form: undefined, props: undefined, state: undefined };
async function show(page: () => ReactNode) {
  const client = createQueryClient();
  const root = () => createElement(Root, { client, entity }, page());
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(root());
  });
  await settle();
  return {
    again: async () => {
      await act(async () => shown!.rerender(root()));
      await settle();
    },
    container: shown!.container,
  };
}

type Files = { error: boolean; placeholder: boolean };
const BOTH: Files = { error: true, placeholder: true };
const NONE: Files = { error: false, placeholder: false };
/** A folder's component, with a placeholder and an error file when `files` says so. */
const make = (path: string, view: () => Promise<unknown>, files: Files) =>
  component({
    ...(files.error
      ? {
          error: ({ className, error, label, resetErrorBoundary }: Props & { error: Error }) =>
            createElement(
              'em',
              { className, onClick: resetErrorBoundary },
              `failed: ${error.message}${label ? ` (${String(label)})` : ''}`,
            ),
        }
      : {}),
    path,
    ...(files.placeholder
      ? {
          placeholder: ({ className, label }: Props) =>
            createElement('i', { className }, `waiting for ${String(label)}`),
        }
      : {}),
    skins: {},
    view,
  } as never);
/** A folder whose view loads when the test says. */
function folder(path: string, render: (props: Props) => ReactNode, files = BOTH) {
  let arrive!: () => void;
  const loaded = new Promise<void>((resolve) => (arrive = resolve));
  const Folder = make(path, () => loaded.then(() => ({ ...layers, render })), files);
  return { arrive: () => act(async () => arrive()), Folder };
}
/** One whose view is there. */
const ready = (path: string, render: (props: Props) => ReactNode, files = BOTH) =>
  make(path, () => Promise.resolve({ ...layers, render }), files);

/** What the page reports and what React or the framework says while a test runs. */
function listening() {
  const failures: Failure[] = [];
  const stop = onFailure((failure) => failures.push(failure));
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  return {
    errors,
    failures,
    stop: () => {
      stop();
      errors.mockRestore();
      warnings.mockRestore();
    },
    warnings,
  };
}

export function cases(mode: 'build' | 'dev') {
  const at = (name: string) => `components/${mode}/${name}`;

  test(`the runtime composes as ${mode === 'dev' ? 'the dev server' : 'a build'} does`, () => {
    expect(HOT).toBe(mode === 'dev');
  });

  test('a folder Root is given shows its placeholder while it waits, with what it was given, then itself', async () => {
    const { arrive, Folder } = folder(at('given'), ({ label }) => createElement('b', null, String(label)));
    const { container } = await show(() => createElement(Folder, { label: 'rows' }));
    expect(container.innerHTML).toBe(`<i class="${at('given')}">waiting for rows</i>`);
    await arrive();
    await settle();
    expect(container.innerHTML).toBe('<b>rows</b>');
  });

  test("a child's boundaries are composed by its parent's render, around the child alone, and the failure names the chain once", async () => {
    const said = listening();
    const child = folder(at('parent/components/child'), () => {
      throw new Error('no rows');
    });
    // As the plugin writes a parent's render: the child's element, bound.
    const Parent = ready(
      at('parent'),
      () => createElement('section', null, 'parent ', bound(createElement(child.Folder, { label: 'rows' }))),
      NONE,
    );
    const { container } = await show(() => createElement(Parent));
    expect(container.textContent).toBe('parent waiting for rows');
    await child.arrive();
    await settle();
    expect(container.textContent).toBe('parent failed: no rows (rows)');
    expect(said.failures.map(({ chain, layer, path }) => ({ chain, layer, path }))).toEqual([
      { chain: [at('parent'), at('parent/components/child')], layer: 'render', path: at('parent/components/child') },
    ]);
    expect(said.warnings).not.toHaveBeenCalled();
    said.stop();
  });

  test('"Try again" shows the folder again, with one report for the one failure; what fails again is reported again', async () => {
    const said = listening();
    let thrown: unknown = new Error('first');
    let broken = true;
    const Child = ready(at('retry/components/child'), () => {
      if (broken) throw thrown;
      return createElement('b', null, 'rows');
    });
    const Parent = ready(at('retry'), () => createElement('section', null, bound(createElement(Child))), NONE);
    const { container } = await show(() => createElement(Parent));
    const retry = async () => {
      await act(async () => fireEvent.click(container.querySelector('em')!));
      await settle();
    };
    expect(container.textContent).toBe('failed: first');
    // Whatever is thrown reaches the error file as an Error: another error, a string, nothing at all.
    thrown = 'a string';
    await retry();
    expect(container.textContent).toBe('failed: a string');
    thrown = null;
    await retry();
    expect(container.querySelector('em')).not.toBeNull();
    expect(said.failures).toHaveLength(3);
    broken = false;
    await retry();
    expect(container.textContent).toBe('rows');
    expect(said.failures).toHaveLength(3);
    said.stop();
  });

  test('an error file that throws goes to the boundary above, not into a loop', async () => {
    const said = listening();
    const Inner = component({
      error: () => {
        throw new Error('the error file fails');
      },
      path: at('outer/components/inner'),
      skins: {},
      view: () =>
        Promise.resolve({
          ...layers,
          render: () => {
            throw new Error('inner fails');
          },
        }),
    } as never);
    const Outer = ready(at('outer'), () => createElement('section', null, bound(createElement(Inner))));
    const { container } = await show(() => createElement(Outer));
    expect(container.textContent).toBe('failed: the error file fails');
    // The inner boundary never showed anything, so React reports to the one that did.
    expect(said.failures.map(({ path }) => path)).toEqual([at('outer')]);
    said.stop();
  });

  test('a failed folder given new props stays failed, and its error file gets them', async () => {
    const said = listening();
    let label = 'one';
    const Child = ready(at('host/components/failing'), () => {
      throw new Error('always');
    });
    const Host = ready(
      at('host'),
      (props) => createElement('section', null, bound(createElement(Child, { label: props['label'] }))),
      NONE,
    );
    const { again, container } = await show(() => createElement(Host, { label }));
    expect(container.textContent).toBe('failed: always (one)');
    label = 'two';
    await again();
    expect(container.textContent).toBe('failed: always (two)');
    expect(said.failures).toHaveLength(1);
    said.stop();
  });

  test('keyed rows with both boundary files keep their DOM and what was typed when they are reordered, and React says nothing', async () => {
    const said = listening();
    let order = ['a', 'b', 'c'];
    const Row = ready(at('list/components/row'), ({ id }) =>
      createElement('li', { 'data-id': id }, createElement('input', { defaultValue: '' })),
    );
    const List = ready(
      at('list'),
      (props) =>
        createElement(
          'ul',
          null,
          (props['order'] as string[]).map((id) => bound(createElement(Row, { id, key: id }))),
        ),
      NONE,
    );
    const { again, container } = await show(() => createElement(List, { order }));
    const rows = () => [...container.querySelectorAll('li')];
    const before = new Map(rows().map((node) => [node.dataset['id'], node]));
    (before.get('a')!.firstChild as HTMLInputElement).value = 'typed in a';
    order = ['c', 'a', 'b'];
    await again();
    expect(rows().map((node) => node.dataset['id'])).toEqual(['c', 'a', 'b']);
    expect(rows().map((node) => before.get(node.dataset['id']) === node)).toEqual([true, true, true]);
    expect((rows()[1]!.firstChild as HTMLInputElement).value).toBe('typed in a');
    expect(said.errors).not.toHaveBeenCalled();
    expect(said.warnings).not.toHaveBeenCalled();
    said.stop();
  });

  test('equal elements compose equal boundaries, a key stays outermost, and anything but a folder is left as it is', () => {
    const { Folder } = folder(at('equal'), () => createElement('b'));
    const Plain = ready(at('plain'), () => null, NONE);
    const plain = createElement(Plain, { label: 'rows' });
    // A build composes nothing around a folder with no boundary file; the dev server, what follows its edits.
    if (mode === 'build') expect(bound(plain)).toBe(plain);
    else expect((bound(plain) as ReactElement<{ given: Props }>).props.given).toBe(plain.props);
    const first = bound(createElement(Folder, { key: 'a', label: 'rows' })) as ReactElement<{
      children: ReactElement;
      given: Props;
    }>;
    expect(first.key).toBe('a');
    expect(first.props.given).toEqual({ label: 'rows' });
    expect(first.props.children.type).toBe(Suspense);
    expect(bound('text')).toBe('text');
    expect(bound(createElement('p'))).toMatchObject({ type: 'p' });
  });

  test(`a folder rendered without its boundaries falls to the nearest ones above${mode === 'dev' ? ', and the dev runtime says so, once' : ''}`, async () => {
    const said = listening();
    const { arrive, Folder } = folder(at('unbound'), () => createElement('b', null, 'shown'));
    // As `const Chosen = wide ? Row : Other; <Chosen />` leaves it: the plugin does not see a folder there.
    const { again, container } = await show(() =>
      createElement('div', null, createElement(Suspense, { fallback: 'the nearest' }, createElement(Folder))),
    );
    expect(container.textContent).toBe('the nearest');
    await arrive();
    await settle();
    expect(container.textContent).toBe('shown');
    await again();
    const told = said.warnings.mock.calls.map(([message]) => String(message));
    if (mode === 'dev') {
      expect(told).toHaveLength(1);
      expect(told[0]).toContain(`${at('unbound')} is rendered without its boundaries`);
    } else expect(told).toEqual([]);
    said.stop();
  });
}
