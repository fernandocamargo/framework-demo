import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { component } from '../component';
import { createQueryClient } from '../data';
import { type Interaction, pipeline } from '../pipeline';
import { Root } from '../root';
import { type Entry, type Keyboard, useKeyboard, useShortcuts } from '../shortcuts';

vi.mock('virtual:framework/clients', () => ({ default: {}, env: {} }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type Props = Record<string, unknown>;
const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
const entity = { id: 'shop' } as never;

/** A component with a chart and keys; its render shows the state it is in. */
const Flow = component({
  path: 'components/flow',
  reads: { acl: [], chart: [], state: [], view: [] },
  skins: {},
  view: () =>
    Promise.resolve({
      async: undefined,
      children: [],
      form: undefined,
      props: undefined,
      render: ({ className, state }: Props) => {
        const current = state as Record<string, unknown>;
        return createElement(
          'p',
          { className },
          Object.keys(current)
            .filter((key) => current[key] === true)
            .join(','),
          createElement('input', { 'aria-label': 'Name' }),
        );
      },
      shortcuts: {
        // Its order matters: the list shows the keys in this order.
        default: ({ when }: Props) => ({
          s: { label: 'Start', send: 'start' },
          'mod+s': { label: 'Save', send: 'save' },
          '/': { focus: 'input', label: 'Name', when: when !== false },
        }),
      },
      state: {
        default: () => ({
          idle: { on: { start: 'editing' } },
          editing: { on: { save: 'saved' } },
          saved: {},
        }),
      },
    }),
});

/** A component that lists the keys on screen, as the framework gives them. */
const Keys = component({
  path: 'components/keys',
  reads: { acl: [], chart: [], state: [], view: ['keyboard'] },
  skins: {},
  view: () =>
    Promise.resolve({
      async: undefined,
      children: [],
      form: undefined,
      props: undefined,
      render: ({ keyboard }: Props) => {
        const { groups } = keyboard as {
          groups: { path: string; shortcuts: { available: boolean; keys: string[]; label: string }[] }[];
        };
        return createElement(
          'ul',
          null,
          groups.flatMap((group) =>
            group.shortcuts.map((shortcut) =>
              createElement(
                'li',
                { key: shortcut.label },
                `${shortcut.keys.join('+')} ${shortcut.label}${shortcut.available ? '' : ' (not now)'}`,
              ),
            ),
          ),
        );
      },
      state: undefined,
    }),
});

/** A component that keeps the keys it is given, to call them. */
let listed: Keyboard | undefined;
const ran = vi.fn();
const skipped = vi.fn();
const Runner = component({
  path: 'components/runner',
  reads: { acl: [], chart: [], state: [], view: ['keyboard'] },
  skins: {},
  view: () =>
    Promise.resolve({
      async: undefined,
      children: [],
      form: undefined,
      props: undefined,
      render: ({ keyboard }: Props) => {
        listed = keyboard as Keyboard;
        return createElement('p', null, 'runner');
      },
      shortcuts: {
        default: () => ({
          r: { label: 'Run', run: ran },
          x: { label: 'Skipped', run: skipped, when: false },
        }),
      },
      state: undefined,
    }),
});

/** A component whose key says which instance ran it. */
const who = vi.fn();
const Named = component({
  path: 'components/named',
  reads: { acl: [], chart: [], state: [], view: [] },
  skins: {},
  view: () =>
    Promise.resolve({
      async: undefined,
      children: [],
      form: undefined,
      props: undefined,
      render: ({ name }: Props) => createElement('p', null, String(name)),
      shortcuts: { default: ({ name }: Props) => ({ n: { label: 'Who', run: () => who(name) } }) },
      state: undefined,
    }),
});

async function show(element: ReactNode) {
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(createElement(Root, { client: createQueryClient(), entity }, element));
  });
  await settle();
  return shown!.container;
}

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init });
  });

test('removing a mounted folder’s shortcuts unregisters its keys', () => {
  type ShortcutProps = { entries: Entry[] | undefined };

  const path = 'components/removing-keys';
  const scope = { parent: null, path };

  const entry: Entry = {
    act: () => undefined,
    available: true,
    combo: { alt: false, ctrl: false, key: 'z', mod: false, shift: false },
    keys: 'z',
    label: 'Remove me',
  };

  const initialProps: ShortcutProps = { entries: [entry] };
  const keyboard = renderHook(() => useKeyboard());

  const owner = renderHook(({ entries }: ShortcutProps) => useShortcuts(path, scope, entries), {
    initialProps,
  });

  expect(keyboard.result.current.groups.find((group) => group.path === path)?.shortcuts[0]?.label).toBe('Remove me');

  owner.rerender({ entries: undefined });
  expect(keyboard.result.current.groups.find((group) => group.path === path)).toBeUndefined();

  owner.unmount();
  keyboard.unmount();
});

test('a key sends its event only while the chart takes it, and the list of keys says which work now', async () => {
  const shown = await show(createElement('div', null, createElement(Flow), createElement(Keys)));
  const flow = () => shown.querySelector('p')!.textContent;
  const list = () => [...shown.querySelectorAll('li')].map((item) => item.textContent);

  expect(flow()).toBe('idle');
  expect(list()).toEqual(['S Start', 'Ctrl+S Save (not now)', '/ Name']);

  // `mod+s` in `idle`: the chart has no `save` there. The browser's own action is still held back.
  const ignored = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: 's' });
  await act(async () => {
    document.body.dispatchEvent(ignored);
  });
  expect(ignored.defaultPrevented).toBe(true);
  expect(flow()).toBe('idle');

  const interactions: Interaction[] = [];
  const listen = (event: Event) => interactions.push((event as CustomEvent<Interaction>).detail);
  pipeline.addEventListener('interaction', listen);
  await press('s');
  await settle();
  pipeline.removeEventListener('interaction', listen);
  expect(flow()).toBe('editing');
  expect(list()).toEqual(['S Start (not now)', 'Ctrl+S Save', '/ Name']);
  // The key ran as an interaction of the component, from its shortcuts.ts.
  expect(interactions.map((interaction) => interaction.name)).toEqual(['components/flow#shortcuts.s']);
  expect(interactions[0]!.chain).toEqual(['components/flow']);

  await press('s', { ctrlKey: true });
  expect(flow()).toBe('saved');
});

test('a key without a modifier is the field’s while one has the focus; a key with one still works', async () => {
  const shown = await show(createElement(Flow));
  const flow = () => shown.querySelector('p')!.textContent;

  await press('/');
  const input = shown.querySelector('input')!;
  expect(document.activeElement).toBe(input);

  await press('s');
  expect(flow()).toBe('idle');
  input.blur();
  await press('s');
  expect(flow()).toBe('editing');

  input.focus();
  await press('s', { ctrlKey: true });
  expect(flow()).toBe('saved');
});

test('a component hidden behind a dialog answers no key', async () => {
  const shown = await show(createElement('div', { 'aria-hidden': 'true' }, createElement(Flow)));
  const flow = () => shown.querySelector('p')!.textContent;
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 's' });
  await act(async () => {
    document.body.dispatchEvent(event);
  });
  expect(flow()).toBe('idle');
  // Not the app's while hidden: the page keeps the key.
  expect(event.defaultPrevented).toBe(false);
});

test('a listed key runs what its shortcut does, and only when it is available', async () => {
  await show(createElement(Runner));
  const shortcut = (label: string) =>
    listed!.groups.flatMap((group) => group.shortcuts).find((item) => item.label === label)!;

  shortcut('Run').run();
  expect(ran).toHaveBeenCalledTimes(1);

  shortcut('Skipped').run();
  expect(skipped).not.toHaveBeenCalled();
});

test('a listed key does what pressing it does: the chart’s event only while the chart takes it, tracked where it was written', async () => {
  const shown = await show(createElement('div', null, createElement(Flow), createElement(Runner)));
  const flow = () => shown.querySelector('p')!.textContent;
  const flowKey = (label: string) =>
    listed!.groups.find((group) => group.path === 'components/flow')!.shortcuts.find((item) => item.label === label)!;

  // `save` in `idle`: the chart has no `save` there, so the key runs nothing.
  await act(async () => flowKey('Save').run());
  expect(flow()).toBe('idle');

  const interactions: Interaction[] = [];
  const listen = (event: Event) => interactions.push((event as CustomEvent<Interaction>).detail);
  pipeline.addEventListener('interaction', listen);
  await act(async () => flowKey('Start').run());
  await settle();
  pipeline.removeEventListener('interaction', listen);
  expect(flow()).toBe('editing');
  expect(interactions.map((interaction) => interaction.name)).toEqual(['components/flow#shortcuts.s']);
});

test('of two instances of a folder, a listed key runs the last shown, as pressing does, and nothing once they leave', async () => {
  const root = (children: ReactNode) => createElement(Root, { client: createQueryClient(), entity }, children);
  let rendered: ReturnType<typeof render> | undefined;
  await act(async () => {
    rendered = render(
      root(
        createElement(
          'div',
          null,
          createElement(Named, { name: 'first' }),
          createElement(Named, { name: 'second' }),
          createElement(Runner),
        ),
      ),
    );
  });
  await settle();
  const run = listed!.groups.find((group) => group.path === 'components/named')!.shortcuts[0]!.run;
  who.mockClear();

  await act(async () => run());
  expect(who).toHaveBeenCalledWith('second');
  await press('n');
  expect(who).toHaveBeenLastCalledWith('second');

  who.mockClear();
  await act(async () => rendered!.rerender(root(createElement(Runner))));
  await settle();
  await act(async () => run());
  expect(who).not.toHaveBeenCalled();
});

test('two Roots on a page each keep their own keys: one leaving takes only its own', async () => {
  const root = (name: string) =>
    createElement(
      Root,
      { client: createQueryClient(), entity },
      createElement('div', null, createElement(Named, { name }), createElement(Runner)),
    );
  let first: ReturnType<typeof render> | undefined;
  let second: ReturnType<typeof render> | undefined;
  await act(async () => {
    first = render(root('first'));
    second = render(root('second'));
  });
  await settle();
  const run = listed!.groups.find((group) => group.path === 'components/named')!.shortcuts[0]!.run;
  who.mockClear();

  await act(async () => run());
  expect(who).toHaveBeenLastCalledWith('second');

  await act(async () => second!.unmount());
  await settle();
  await act(async () => run());
  expect(who).toHaveBeenLastCalledWith('first');

  who.mockClear();
  await act(async () => first!.unmount());
  await settle();
  await act(async () => run());
  expect(who).not.toHaveBeenCalled();
});
