import { act } from '@testing-library/react';
import { createElement, startTransition, Suspense, use, useState } from 'react';

import { component } from '../component';
import { createQueryClient } from '../data';
import { Root } from '../root';
import { entity, settle, show, viewOf } from '../testing';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type State = { done?: boolean; send: (event: { type: string }) => void };

test('a render React throws away leaves the decision the guards read as the page shows it', async () => {
  let state: State | undefined;
  const Gate = component({
    path: 'components/gate',
    reads: { acl: ['locked'], state: ['acl'], view: ['acl'] },
    skins: {},
    view: viewOf<{ acl: { allowed: boolean }; locked: boolean; state: State }>(
      ({ acl, state: current }) => {
        state = current;
        return createElement('p', null, state['done'] ? 'done' : acl.allowed ? 'open' : 'locked');
      },
      {
        // Its own rule, from a prop: decided in each render.
        acl: ({ locked }: { locked: boolean }) => !locked,
        async: undefined,
        state: {
          allowed: ({ acl }: { acl: { allowed: boolean } }) => acl.allowed,
          default: {
            waiting: { on: { go: { guard: ({ acl }: { acl: { allowed: boolean } }) => acl.allowed, target: 'done' } } },
            done: {},
          },
        },
      },
    ),
  });
  // A sibling that never arrives while `locked`: the transition that locks the gate never commits.
  const never = new Promise<never>(() => undefined);
  const Slow = ({ wait }: { wait: boolean }) => (wait ? use(never) : null);
  let lock: (locked: boolean) => void = () => undefined;
  const Page = () => {
    const [locked, setLocked] = useState(false);
    lock = setLocked;
    return createElement(
      Suspense,
      { fallback: null },
      createElement(Gate, { locked }),
      createElement(Slow, { wait: locked }),
    );
  };
  const shown = await show(createElement(Root, { client: createQueryClient(), entity }, createElement(Page)), 8);
  expect(shown.container.textContent).toBe('open');

  // React renders the gate locked, then waits for the sibling, and commits nothing.
  await act(async () => startTransition(() => lock(true)));
  await settle(8);
  expect(shown.container.textContent).toBe('open');
  // The person goes back before it arrives: the page is as it was, and the gate does not render again.
  await act(async () => startTransition(() => lock(false)));
  await settle(8);
  expect(shown.container.textContent).toBe('open');

  // The page shows the gate open, so its guard lets the event through.
  await act(async () => state!.send({ type: 'go' }));
  await settle(8);
  expect(shown.container.textContent).toBe('done');
});

test('a render React throws away is not what the next render is compared with: what the page shows is', async () => {
  const calls: unknown[] = [];
  // A piece of the page that says whether the page is odd: the same on pages 1 and 3.
  let marked = 0;
  const Marker = ({ odd }: { odd: boolean }) => {
    marked++;
    return createElement('b', null, odd ? 'odd ' : 'even ');
  };
  const Paged = component({
    path: 'components/paged',
    reads: { view: ['route'] },
    skins: {},
    view: viewOf<{ page: number }>(
      ({ page }) => {
        calls.push(page);
        return createElement('p', null, createElement(Marker, { odd: page % 2 === 1 }), `page ${String(page)}`);
      },
      {
        props: { default: ({ route }: { route: { page: number } }) => ({ page: route.page }) },
        // The key's label follows the page, so the keys on screen say which render registered them.
        shortcuts: { default: ({ route }: { route: { page: number } }) => ({ g: { label: `page ${route.page}` } }) },
      },
    ),
  });
  /** The keys on screen, as the framework lists them. */
  const Keys = component({
    path: 'components/keys',
    reads: { view: ['keyboard'] },
    skins: {},
    view: viewOf<{ keyboard: { groups: { shortcuts: { label: string }[] }[] } }>(({ keyboard }) =>
      createElement(
        'i',
        null,
        keyboard.groups.flatMap((group) => group.shortcuts.map((shortcut) => shortcut.label)).join(),
      ),
    ),
  });
  const never = new Promise<never>(() => undefined);
  const Slow = ({ wait }: { wait: boolean }) => (wait ? use(never) : null);
  let turn: (page: number) => void = () => undefined;
  const client = createQueryClient();
  const Page = () => {
    const [page, setPage] = useState(1);
    turn = setPage;
    return createElement(
      Root,
      { client, entity, route: { page } as never },
      createElement(
        Suspense,
        { fallback: null },
        createElement(Paged),
        createElement(Slow, { wait: page === 2 }),
        createElement(Keys),
      ),
    );
  };
  const shown = await show(createElement(Page), 8);
  // The page, then the keys on screen: the one key, labelled by the page.
  expect(shown.container.textContent).toBe('odd page 1page 1');
  const mounted = calls.length;
  const markedOnce = marked;

  // React renders page 2, waits for the sibling, and commits nothing.
  await act(async () => startTransition(() => turn(2)));
  await settle(8);
  expect(shown.container.textContent).toBe('odd page 1page 1');
  expect(calls.slice(mounted)).toEqual([2]);
  expect(marked).toBe(markedOnce + 1);
  // The person moves on to page 3. Its render is compared with page 1, which the page shows, not
  // with page 2, which it never showed: the marker is the element React showed, and is skipped.
  await act(async () => startTransition(() => turn(3)));
  await settle(8);
  expect(shown.container.textContent).toBe('odd page 3page 3');
  expect(calls.slice(mounted)).toEqual([2, 3]);
  expect(marked).toBe(markedOnce + 1);
});
