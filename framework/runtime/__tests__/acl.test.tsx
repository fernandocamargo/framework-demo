import { act } from '@testing-library/react';
import { createElement } from 'react';

import { component } from '../component';
import { createQueryClient } from '../data';
import { type Failure, onFailure } from '../pipeline';
import { Root } from '../root';
import { entity, settle, show, viewOf } from '../testing';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type Person = null | { id: number; role: string };

test("a folder's acl.ts reaches every component below it, until one below says otherwise; only those that read it render again", async () => {
  const calls: string[] = [];
  const Leaf = component({
    path: 'components/page/leaf',
    reads: { view: ['acl'] },
    skins: {},
    view: viewOf<{ acl: { allowed: boolean } }>(({ acl }) => {
      calls.push('leaf');
      return createElement('i', null, acl.allowed ? 'leaf:yes ' : 'leaf:no ');
    }),
  });
  const Narrow = component({
    path: 'components/page/narrow',
    reads: { view: ['acl', 'user'] },
    skins: {},
    view: viewOf<{ acl: { allowed: boolean }; user: Person }>(
      ({ acl }) => createElement('b', null, acl.allowed ? 'narrow:yes ' : 'narrow:no '),
      {
        acl: ({ acl, user }) => acl.allowed && user?.role === 'admin',
      },
    ),
  });
  const Plain = component({
    path: 'components/page/plain',
    skins: {},
    view: viewOf(() => {
      calls.push('plain');
      return createElement('u', null, 'plain');
    }),
  });
  const Page = component({
    path: 'components/page',
    reads: { view: ['user'] },
    skins: {},
    view: viewOf<{ user: Person }>(
      () => createElement('div', null, createElement(Leaf), createElement(Narrow), createElement(Plain)),
      { acl: ({ user }) => user?.role !== 'user' },
    ),
  });
  let person: Person = { id: 1, role: 'admin' };
  // The app declares its own User (src/env.d.ts); these tests use their own.
  const user = (async () => person) as never;
  const client = createQueryClient();
  const { container, rerender } = await show(createElement(Root, { client, entity, user }, createElement(Page)));
  expect(container.textContent).toBe('leaf:yes narrow:yes plain');

  // Another person: the user read runs again (here the client is told to refetch it), and the
  // rules with it. The plain component, which reads neither, does not render.
  calls.length = 0;
  person = { id: 2, role: 'moderator' };
  await act(async () => {
    await client.invalidateQueries();
  });
  await act(async () => rerender(createElement(Root, { client, entity, user }, createElement(Page))));
  await settle();
  expect(container.textContent).toBe('leaf:yes narrow:no plain');
  expect(calls).toEqual([]);

  person = { id: 3, role: 'user' };
  await act(async () => {
    await client.invalidateQueries();
  });
  await settle();
  expect(container.textContent).toBe('leaf:no narrow:no plain');
  expect(calls).toEqual(['leaf']);
});

test('a rule that throws refuses, and is reported as the acl layer', async () => {
  const failures: Failure[] = [];
  const stop = onFailure((failure) => failures.push(failure));
  const Guarded = component({
    path: 'components/guarded',
    reads: { view: ['acl'] },
    skins: {},
    view: viewOf<{ acl: { allowed: boolean } }>(({ acl }) => createElement('p', null, acl.allowed ? 'yes' : 'no'), {
      acl: () => {
        throw new Error('no rule');
      },
    }),
  });
  const { container } = await show(
    createElement(Root, { client: createQueryClient(), entity }, createElement(Guarded)),
  );
  expect(container.textContent).toBe('no');
  expect(failures.map((failure) => [failure.layer, failure.path, failure.error.message])).toContainEqual([
    'acl',
    'components/guarded',
    'no rule',
  ]);
  stop();
});

test('a component follows only the parts of the backend snapshot it reads', async () => {
  const calls: string[] = [];
  const Decision = component({
    path: 'components/decision',
    reads: { view: ['acl'] },
    skins: {},
    view: viewOf<{ acl: { allowed: boolean } }>(({ acl }) => {
      calls.push('decision');
      return createElement('i', null, acl.allowed ? 'yes ' : 'no ');
    }),
  });
  const Limit = component({
    path: 'components/limit',
    reads: { view: ['acl'] },
    skins: {},
    view: viewOf<{ acl: { limits: { change: number } } }>(({ acl }) => {
      calls.push('limit');
      return createElement('b', null, String(acl.limits.change));
    }),
  });
  let snapshot = { limits: { change: 20 }, role: 'moderator' };
  const acl = (async () => snapshot) as never;
  const client = createQueryClient();
  const { container } = await show(
    createElement(Root, { acl, client, entity }, createElement(Decision), createElement(Limit)),
  );
  expect(container.textContent).toBe('yes 20');

  calls.length = 0;
  snapshot = { limits: { change: 50 }, role: 'admin' };
  await act(async () => {
    await client.invalidateQueries();
  });
  await settle();
  expect(container.textContent).toBe('yes 50');
  expect(calls).toEqual(['limit']);
});
