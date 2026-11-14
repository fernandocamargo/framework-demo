import { QueryObserver } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { component } from '../component';
import { createDataLayer, createQueryClient, name, recording } from '../data';
import { type DataEvent, onData } from '../pipeline';
import { Root } from '../root';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type Props = Record<string, unknown>;
type Layers = { acl?: (given: Props) => unknown };
const view =
  (render: (props: Props) => ReactNode, layers: Layers = {}) =>
  () =>
    Promise.resolve({
      acl: layers.acl ? { default: layers.acl } : undefined,
      async: undefined,
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
async function show(element: ReactNode) {
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(element);
  });
  await settle();
  return shown!.container;
}
const entity = { id: 'shop' } as never;
type Person = null | { id: number };
type Flagged = { counting: boolean; deletions: boolean; theme: string };

test('the flags are for the person the user read names, and a component follows only the flags it reads', async () => {
  const calls: string[] = [];
  const Counter = component({
    path: 'components/counter',
    reads: { view: ['flags'] },
    skins: {},
    view: view(({ flags }) => {
      calls.push('counter');
      return createElement('i', null, (flags as Flagged).counting ? 'count ' : 'plain ');
    }),
  });
  const Themed = component({
    path: 'components/themed',
    reads: { view: ['flags'] },
    skins: {},
    view: view(({ flags }) => {
      calls.push('themed');
      return createElement('b', null, (flags as Flagged).theme);
    }),
  });
  let person: Person = { id: 1 };
  let theme = 'light';
  const asked: Person[] = [];
  const user = (async () => person) as never;
  // Targeted by the person: counting is on for the first one only.
  const flags = (async ({ user }: { user: Person }) => {
    asked.push(user);
    return { counting: user?.id === 1, deletions: true, theme };
  }) as never;
  const client = createQueryClient();
  const container = await show(
    createElement(Root, { client, entity, flags, user }, createElement(Counter), createElement(Themed)),
  );
  expect(container.textContent).toBe('count light');
  expect(asked).toEqual([{ id: 1 }]);

  // A flag one of them reads changes: only that one renders.
  calls.length = 0;
  theme = 'dark';
  await act(async () => {
    await client.invalidateQueries();
  });
  await settle();
  expect(container.textContent).toBe('count dark');
  expect(calls).toEqual(['themed']);

  // Another person: the flags are read again for them.
  calls.length = 0;
  person = { id: 2 };
  await act(async () => {
    await client.invalidateQueries();
  });
  await settle();
  expect(asked.at(-1)).toEqual({ id: 2 });
  expect(container.textContent).toBe('plain dark');
  expect(calls).toEqual(['counter']);
});

test('a folder rule that reads the snapshot and the flags renders an instance again only when its decision changes', async () => {
  const calls: string[] = [];
  const Link = component({
    path: 'components/link',
    reads: { acl: ['acl', 'flags'], view: ['acl'] },
    skins: {},
    view: view(
      ({ acl, id }) => {
        calls.push(`link ${String(id)}`);
        return createElement('i', null, (acl as { allowed: boolean }).allowed ? 'yes ' : 'no ');
      },
      {
        acl: ({ acl, flags }) =>
          (flags as Flagged).deletions && (acl as { grants: string[] }).grants.includes('delete'),
      },
    ),
  });
  let snapshot = { grants: ['delete'], role: 'admin' };
  let flagged: Flagged = { counting: true, deletions: true, theme: 'light' };
  const acl = (async () => snapshot) as never;
  const flags = (async () => flagged) as never;
  const client = createQueryClient();
  const container = await show(
    createElement(Root, { acl, client, entity, flags }, ...[1, 2, 3].map((id) => createElement(Link, { id, key: id }))),
  );
  expect(container.textContent).toBe('yes yes yes ');

  // Neither change moves the decision: nothing renders.
  calls.length = 0;
  snapshot = { grants: ['delete'], role: 'moderator' };
  flagged = { ...flagged, theme: 'dark' };
  await act(async () => {
    await client.invalidateQueries();
  });
  await settle();
  expect(calls).toEqual([]);

  // The kill switch: every instance's decision changes, and each renders once.
  flagged = { ...flagged, deletions: false };
  await act(async () => {
    await client.invalidateQueries();
  });
  await settle();
  expect(container.textContent).toBe('no no no ');
  expect(calls).toEqual(['link 1', 'link 2', 'link 3']);
});

test('a read that follows its source is read again when the source says so, with the components that read it', async () => {
  const client = createQueryClient();
  const data = createDataLayer(client, { id: 'shop' });
  const source = { listeners: new Set<() => void>(), value: 'on' };
  const evaluate = async () => source.value;
  name(evaluate, 'flags.evaluate');
  data.rule('flags.evaluate', {
    follows: (stale) => {
      source.listeners.add(stale);
      return () => source.listeners.delete(stale);
    },
    reads: true,
  });
  const operation = () => data.call('flags.evaluate', evaluate as never, []) as Promise<string>;
  name(operation, 'flags.evaluate');
  const query = data.component('components/banner', {}, async (record) => {
    const services = recording({ flags: { evaluate: operation } }, record.service, record.peek);
    return `banner ${await services.flags.evaluate()}`;
  });
  await client.fetchQuery(query);
  const stop = new QueryObserver(client, query).subscribe(() => undefined);
  expect(client.getQueryData(query.queryKey)).toBe('banner on');

  const events: DataEvent[] = [];
  const unlisten = onData((event) => events.push(event));
  source.value = 'off';
  await act(async () => {
    source.listeners.forEach((stale) => stale());
  });
  await settle();
  expect(client.getQueryData(query.queryKey)).toBe('banner off');
  expect(
    events.filter((event) => event.action === 'stale').map(({ outcome, path, reads }) => ({ outcome, path, reads })),
  ).toEqual([{ outcome: 'pushed', path: 'flags.evaluate', reads: ['flags.evaluate'] }]);
  unlisten();
  stop();
});
