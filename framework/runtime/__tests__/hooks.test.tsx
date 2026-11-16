// Which hooks a component calls is chosen once, from what its folder's files read and from its
// view's files, before its first render. These tests hold what that choice must keep true: each
// kind of component gets what it reads, renders again through a change without React seeing a
// hook come or go, and a Root that lacks a read stands in for it.

import { act, render } from '@testing-library/react';
import { createElement, useState } from 'react';

import { useOperations } from '../async';
import { component, type Spec } from '../component';
import { createQueryClient } from '../data';
import { useFormLayer } from '../form';
import type { StateModule } from '../machine';
import { Root } from '../root';
import { entity, settle, show, viewOf } from '../testing';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));
vi.mock('../async', { spy: true });
vi.mock('../form', { spy: true });

/** A component of one kind: what its files read, and which layer files its view has. */
const kind = <P,>(
  name: string,
  reads: Spec['reads'],
  text: (props: P) => string,
  layers: { read?: () => Promise<string>; state?: StateModule } = {},
) =>
  component({
    i18n: name === 'spoken' ? { default: { hello: 'hello' } } : undefined,
    path: `components/${name}`,
    reads,
    skins: {},
    view: viewOf<P>((props) => createElement('i', null, `${name}:${text(props)} `), {
      async: layers.read ? { default: layers.read } : undefined,
      state: layers.state,
    }),
  });

test.each([
  { answer: undefined, async: undefined, name: 'no async layer' },
  { answer: {}, async: {}, name: 'an empty async layer' },
  { answer: { default: 'answer' }, async: { default: () => Promise.resolve('answer') }, name: 'only a default read' },
])('a folder with $name runs no absent form or operation hooks', async ({ answer, async }) => {
  vi.mocked(useFormLayer).mockClear();
  vi.mocked(useOperations).mockClear();
  const calls = vi.fn((props: { async?: { default?: string }; round: number }) =>
    createElement('p', null, String(props.round)),
  );
  const Plain = component({
    path: 'components/without-layers',
    skins: {},
    view: viewOf(calls, { async }),
  });
  const client = createQueryClient();
  const page = (round: number) => createElement(Root, { client, entity }, createElement(Plain, { round }));
  const shown = await act(async () => render(page(0)));
  await settle(8);
  expect(shown.container.textContent).toBe('0');
  await act(async () => shown.rerender(page(1)));
  await settle(8);
  expect(shown.container.textContent).toBe('1');
  for (const [given] of calls.mock.calls) {
    expect(given).not.toHaveProperty('form');
    expect(given['async']).toEqual(answer);
  }
  expect([vi.mocked(useFormLayer).mock.calls.length, vi.mocked(useOperations).mock.calls.length]).toEqual([0, 0]);
});

test('each kind of component gets what it reads, and renders again without a hook coming or going', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const kinds = [
    kind('plain', {}, () => 'x'),
    kind<{ user: { id: number } }>('user', { view: ['user'] }, ({ user }) => String(user.id)),
    kind<{ acl: { role: string } }>('acl', { view: ['acl'] }, ({ acl }) => acl.role),
    kind<{ flags: { on: boolean } }>('flags', { view: ['flags'] }, ({ flags }) => String(flags.on)),
    kind<{ acl: { role: string }; flags: { on: boolean } }>('both', { view: ['acl', 'flags'] }, ({ acl, flags }) =>
      [acl.role, flags.on].join('+'),
    ),
    kind<{ keyboard: object }>('keys', { view: ['keyboard'] }, ({ keyboard }) => typeof keyboard),
    kind<{ i18n: { hello: string }; locale: string }>('spoken', { view: ['i18n', 'locale'] }, ({ i18n, locale }) =>
      [i18n.hello, locale].join('+'),
    ),
    kind<{ async: { default: string } }>('read', {}, ({ async }) => String(async.default), {
      read: () => Promise.resolve('answer'),
    }),
    kind<{ state: { idle: boolean } }>('chart', { state: [] }, ({ state }) => String(state.idle), {
      state: { default: { idle: {} } },
    }),
  ];
  let person = { id: 1 };
  let role = 'admin';
  let on = true;
  const user = (async () => person) as never;
  const acl = (async () => ({ role })) as never;
  const flags = (async () => ({ on })) as never;
  const client = createQueryClient();
  let rerender: (count: number) => void = () => undefined;
  const Page = () => {
    const [count, setCount] = useState(0);
    rerender = setCount;
    return createElement(
      Root,
      { acl, client, entity, flags, locale: count % 2 ? 'pt-BR' : 'en', user },
      ...kinds.map((Kind, index) => createElement(Kind, { key: index, round: count })),
    );
  };
  const { container } = await show(createElement(Page), 8);
  expect(container.textContent).toBe(
    'plain:x user:1 acl:admin flags:true both:admin+true keys:object spoken:hello+en read:answer chart:true ',
  );

  // Every source changes, and every component renders again for a new prop.
  person = { id: 2 };
  role = 'moderator';
  on = false;
  await act(async () => {
    await client.invalidateQueries();
    rerender(1);
  });
  await settle(8);
  expect(container.textContent).toBe(
    'plain:x user:2 acl:moderator flags:false both:moderator+false keys:object spoken:hello+pt-BR read:answer chart:true ',
  );
  // React says so, in development, when a render calls other hooks than the one before.
  expect(errors.mock.calls.map((call) => String(call[0]))).toEqual([]);
  errors.mockRestore();
});

test('under a Root with no user, acl or flags read, a component that reads them gets nobody and everything allowed', async () => {
  const calls: string[] = [];
  const Reader = component({
    path: 'components/reader',
    reads: { view: ['acl', 'flags', 'user'] },
    skins: {},
    view: viewOf<{ acl: { allowed: boolean }; flags: object; round: boolean; user: null }>(
      ({ acl, flags, round, user }) => {
        calls.push(String(round));
        return createElement('i', null, [String(user), acl.allowed, Object.keys(flags).length].join(' '));
      },
    ),
  });
  let rerender: (round: number) => void = () => undefined;
  const Page = () => {
    const [round, setRound] = useState(0);
    rerender = setRound;
    return createElement(Root, { client: createQueryClient(), entity }, createElement(Reader, { round: round > 1 }));
  };
  const { container } = await show(createElement(Page), 8);
  expect(container.textContent).toBe('null true 0');
  expect(calls).toEqual(['false']);

  // The page renders again and passes the same props: the render is not called.
  await act(async () => rerender(1));
  await settle(8);
  expect(calls).toEqual(['false']);
  await act(async () => rerender(2));
  await settle(8);
  expect(calls).toEqual(['false', 'true']);
});
