import { act, render } from '@testing-library/react';
import { createElement, startTransition, Suspense, use, useState } from 'react';
import { useLocation } from 'react-router';

import { component } from '../component';
import { createQueryClient } from '../data';
import { Root } from '../root';
import { routed, useTestRoute } from './routed';

vi.mock('virtual:framework/clients', () => ({ default: {}, env: {} }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type Props = Record<string, unknown>;
type State = { send: (event: { type: string }) => void } & Record<string, unknown>;
const entity = { id: 'shop' } as never;
const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

test('a render React throws away leaves the decision the guards read as the page shows it', async () => {
  let state: State | undefined;
  const Gate = component({
    path: 'components/gate',
    reads: { acl: ['locked'], state: ['acl'], view: ['acl'] },
    skins: {},
    useRoute: useTestRoute,
    view: () =>
      Promise.resolve({
        // Its own rule, from a prop: decided in each render.
        acl: { default: ({ locked }: { locked: boolean }) => !locked },
        async: undefined,
        children: [],
        form: undefined,
        props: undefined,
        render: (props: Props) => {
          state = props['state'] as State;
          return createElement(
            'p',
            null,
            state['done'] ? 'done' : (props['acl'] as { allowed: boolean }).allowed ? 'open' : 'locked',
          );
        },
        state: {
          allowed: ({ acl }: { acl: { allowed: boolean } }) => acl.allowed,
          default: {
            waiting: { on: { go: { guard: ({ acl }: { acl: { allowed: boolean } }) => acl.allowed, target: 'done' } } },
            done: {},
          },
        },
      }) as never,
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
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(createElement(Root, { client: createQueryClient(), entity }, createElement(Page)));
  });
  await settle();
  expect(shown!.container.textContent).toBe('open');

  // React renders the gate locked, then waits for the sibling, and commits nothing.
  await act(async () => startTransition(() => lock(true)));
  await settle();
  expect(shown!.container.textContent).toBe('open');
  // The person goes back before it arrives: the page is as it was, and the gate does not render again.
  await act(async () => startTransition(() => lock(false)));
  await settle();
  expect(shown!.container.textContent).toBe('open');

  // The page shows the gate open, so its guard lets the event through.
  await act(async () => state!.send({ type: 'go' }));
  await settle();
  expect(shown!.container.textContent).toBe('done');
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
    useRoute: useTestRoute,
    view: () =>
      Promise.resolve({
        async: undefined,
        children: [],
        form: undefined,
        props: { default: ({ route }: { route: { page: number } }) => ({ page: route.page }) },
        render: ({ page }: Props) => {
          calls.push(page);
          return createElement(
            'p',
            null,
            createElement(Marker, { odd: (page as number) % 2 === 1 }),
            `page ${String(page)}`,
          );
        },
        // The key's label follows the page, so the keys on screen say which render registered them.
        shortcuts: { default: ({ route }: Props) => ({ g: { label: `page ${(route as { page: number }).page}` } }) },
        state: undefined,
      }) as never,
  });
  /** The keys on screen, as the framework lists them. */
  const Keys = component({
    path: 'components/keys',
    reads: { view: ['keyboard'] },
    skins: {},
    useRoute: useTestRoute,
    view: () =>
      Promise.resolve({
        async: undefined,
        children: [],
        form: undefined,
        props: undefined,
        render: ({ keyboard }: Props) =>
          createElement(
            'i',
            null,
            (keyboard as { groups: { shortcuts: { label: string }[] }[] }).groups
              .flatMap((group) => group.shortcuts.map((shortcut) => shortcut.label))
              .join(),
          ),
        state: undefined,
      }) as never,
  });
  const never = new Promise<never>(() => undefined);
  // Page 2 has a sibling that never arrives: React renders it and commits nothing.

  const Slow = () =>
    JSON.parse(new URLSearchParams(useLocation().search).get('query') ?? '{}').page === 2 ? use(never) : null;
  const client = createQueryClient();

  const page = routed({ page: 0 }, { page: 1 }, () =>
    createElement(
      Root,
      { client, entity },
      createElement(Suspense, { fallback: null }, createElement(Paged), createElement(Slow), createElement(Keys)),
    ),
  );
  // The router changes its location in a transition of its own.
  const turn = (to: number) => page.go({ page: to });
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(page.element);
  });
  await settle();
  // The page, then the keys on screen: the one key, labelled by the page.
  expect(shown!.container.textContent).toBe('odd page 1page 1');
  const mounted = calls.length;
  const markedOnce = marked;

  // React renders page 2, waits for the sibling, and commits nothing.
  await turn(2);
  await settle();
  expect(shown!.container.textContent).toBe('odd page 1page 1');
  expect(calls.slice(mounted)).toEqual([2]);
  expect(marked).toBe(markedOnce + 1);
  // The person moves on to page 3. Its render is compared with page 1, which the page shows, not
  // with page 2, which it never showed: the marker is the element React showed, and is skipped.
  await turn(3);
  await settle();
  expect(shown!.container.textContent).toBe('odd page 3page 3');
  expect(calls.slice(mounted)).toEqual([2, 3]);
  expect(marked).toBe(markedOnce + 1);
});
