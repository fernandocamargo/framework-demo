import { act, render } from '@testing-library/react';
import { createElement, startTransition, Suspense, use, useState } from 'react';

import { component } from '../component';
import { createQueryClient } from '../data';
import { Root } from '../root';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
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
