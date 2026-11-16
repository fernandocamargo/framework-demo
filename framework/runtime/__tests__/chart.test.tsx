import { act } from '@testing-library/react';
import { createElement } from 'react';

import { component } from '../component';
import { createQueryClient } from '../data';
import { Pinned } from '../pin';
import { Root } from '../root';
import { entity, settle, show, viewOf } from '../testing';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type State = { [key: string]: ((event: { type: string }) => void) | boolean; send: (event: { type: string }) => void };

/** A component whose chart is declared from `acl`, its rule from the snapshot; its render shows the states it is in. */
function setup(declaration: (injection: { acl: { allowed: boolean } }) => object, state: string[] = []) {
  let send: State['send'] = () => undefined;
  const Flow = component({
    path: 'components/flow',
    reads: { acl: ['acl'], chart: ['acl'], state, view: [] },
    skins: {},
    view: viewOf<{ acl: { grants: string[] }; state: State }>(
      ({ state }) => {
        send = state.send;
        return createElement(
          'p',
          null,
          Object.keys(state)
            .filter((key) => state[key] === true)
            .join(','),
        );
      },
      {
        acl: ({ acl }) => acl.grants.includes('update'),
        state: { default: declaration },
      },
    ),
  });
  let grants = ['update'];
  const acl = (async () => ({ grants })) as never;
  const client = createQueryClient();
  return {
    element: createElement(Root, { acl, client, entity }, createElement(Flow)),
    grant: async (next: string[]) => {
      grants = next;
      await act(async () => {
        await client.invalidateQueries();
      });
      await settle(8);
    },
    send: (type: string) => act(async () => send({ type })),
  };
}

test('a chart declared from acl is declared again when what it read changes, and keeps its place', async () => {
  const flow = setup(({ acl }) => ({
    idle: { on: { start: 'editing' } },
    editing: { on: { ...(acl.allowed && { save: 'saved' }), stop: 'idle' } },
    saved: {},
  }));
  const { container: shown } = await show(flow.element, 8);
  await flow.send('start');
  expect(shown.textContent).toBe('editing');

  // The grant goes: the chart is declared with no `save`, still in `editing`.
  await flow.grant([]);
  await flow.send('save');
  await settle(8);
  expect(shown.textContent).toBe('editing');

  // It comes back: `save` is there again, and the flow is where it was.
  await flow.grant(['update']);
  await flow.send('save');
  await settle(8);
  expect(shown.textContent).toBe('saved');
});

test('a chart running a service moves to the new chart only once it rests', async () => {
  let finish: () => void = () => undefined;
  const work = () => new Promise<void>((resolve) => (finish = resolve));
  const flow = setup(({ acl }) => ({
    idle: { on: { start: 'working' } },
    working: { invoke: { onDone: 'done', src: work } },
    done: { on: { ...(acl.allowed && { again: 'idle' }) } },
  }));
  const { container: shown } = await show(flow.element, 8);
  await flow.send('start');
  expect(shown.textContent).toBe('working');

  // Declared again while the service runs: the running chart sees it through.
  await flow.grant([]);
  expect(shown.textContent).toBe('working');
  await act(async () => finish());
  await settle(8);
  expect(shown.textContent).toBe('done');

  // At rest now, in the chart declared without `again`.
  await flow.send('again');
  await settle(8);
  expect(shown.textContent).toBe('done');
});

test('a chart whose new declaration has no such state starts over', async () => {
  const flow = setup(({ acl }) => (acl.allowed ? { idle: { on: { open: 'special' } }, special: {} } : { idle: {} }));
  const { container: shown } = await show(flow.element, 8);
  await flow.send('open');
  expect(shown.textContent).toBe('special');
  await flow.grant([]);
  expect(shown.textContent).toBe('idle');
});

test('a chart whose file reads a source is told when it changes, by an event of its name', async () => {
  // The guard reads the snapshot as it is when the event arrives.
  const refused = ({ acl }: { acl: { grants?: string[] } }) => !acl.grants?.includes('update');
  const flow = setup(
    () => ({
      waiting: { on: { acl: { guard: refused, target: 'refused' } } },
      refused: {},
    }),
    ['acl'],
  );
  const { container: shown } = await show(flow.element, 8);
  expect(shown.textContent).toBe('waiting');

  await flow.grant(['update', 'delete']);
  expect(shown.textContent).toBe('waiting');
  await flow.grant([]);
  expect(shown.textContent).toBe('refused');
});

test('a pinned component shows the state it is held in, with the example over its context, and its chart does not move', async () => {
  const flow = setup(() => ({
    idle: { on: { start: 'editing' } },
    editing: { on: { save: 'saved' } },
    saved: {},
  }));
  const { container: shown } = await show(
    createElement(
      Pinned,
      { example: { context: { note: 'held' } }, path: 'components/flow', state: 'editing' },
      flow.element,
    ),
    8,
  );
  expect(shown.textContent).toBe('editing');
  await flow.send('save');
  await settle(8);
  expect(shown.textContent).toBe('editing');
});
