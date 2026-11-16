import { act, render } from '@testing-library/react';
import { createElement } from 'react';

// React DevTools' hook, before React loads: it counts each framework component React renders in a
// commit, even one whose output is the same (as route.test.tsx and perf/recorder.js do).
const rendered = vi.hoisted(() => {
  const counts = new Map<string, number>();
  const PERFORMED_WORK = 1;
  type Fiber = {
    alternate: Fiber | null;
    child: Fiber | null;
    flags: number;
    sibling: Fiber | null;
    tag: number;
    type: unknown;
  };
  const walk = (parent: Fiber) => {
    if (parent.alternate && parent.child === parent.alternate.child) return;
    for (let node = parent.child; node; node = node.sibling) {
      const type = typeof node.type === 'function' ? (node.type as { displayName?: string; name: string }) : null;
      const view = type !== null && type.name === 'View';
      if (view && node.alternate && (node.flags & PERFORMED_WORK) === PERFORMED_WORK)
        counts.set(type.displayName!, (counts.get(type.displayName!) ?? 0) + 1);
      walk(node);
    }
  };
  const renderers = new Map<number, unknown>();
  (globalThis as Record<string, unknown>)['__REACT_DEVTOOLS_GLOBAL_HOOK__'] = {
    checkDCE() {},
    inject: (renderer: unknown) => (renderers.set(renderers.size + 1, renderer), renderers.size),
    isDisabled: false,
    onCommitFiberRoot: (_: number, root: { current: Fiber }) => walk(root.current),
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onScheduleFiberRoot() {},
    renderers,
    setStrictMode() {},
    supportsFiber: true,
  };
  return counts;
});

import { component } from '../component';
import { createQueryClient } from '../data';
import { Root } from '../root';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
vi.mock('virtual:framework/services', () => ({ default: [] }));

type Props = Record<string, unknown>;
type State = { context: { list: number[] }; send: (event: { list?: number[]; type: string }) => void } & Record<
  string,
  unknown
>;
const entity = { id: 'shop' } as never;
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

test('a state entered again, with nothing new in its context, renders nothing', async () => {
  const remember = ({ event }: { event: { list?: number[] } }) => ({ list: event.list });
  let state: State | undefined;
  const Panel = component({
    path: 'components/panel',
    skins: {},
    view: () =>
      Promise.resolve({
        async: undefined,
        children: [],
        form: undefined,
        props: undefined,
        render: (props: Props) => {
          state = props['state'] as State;
          return createElement('p', null, `${state['open'] ? 'open' : 'closed'}: ${state.context.list.join(',')}`);
        },
        state: {
          context: () => ({ list: [1, 2] }),
          default: {
            closed: { on: { toggle: 'open' } },
            // `read` enters the state again and remembers what it read, as a panel that reads every second.
            open: { on: { read: { actions: remember, reenter: true, target: 'open' }, toggle: 'closed' } },
          },
        },
      }) as never,
  });
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(createElement(Root, { client: createQueryClient(), entity }, createElement(Panel)));
  });
  await settle();
  const { container } = shown!;
  await act(async () => state!.send({ type: 'toggle' }));
  expect(container.textContent).toBe('open: 1,2');
  const list = state!.context.list;
  rendered.clear();

  // The same list, read again as a new array: the context keeps the one it held, and nothing renders.
  await act(async () => state!.send({ list: [1, 2], type: 'read' }));
  await settle();
  expect(rendered.get('components/panel')).toBeUndefined();
  expect(state!.context.list).toBe(list);

  // Another list renders it.
  await act(async () => state!.send({ list: [1, 2, 3], type: 'read' }));
  await settle();
  expect(container.textContent).toBe('open: 1,2,3');
  expect(rendered.get('components/panel')).toBe(1);

  // And the chart still moves: a state that changes is shown.
  await act(async () => state!.send({ type: 'toggle' }));
  expect(container.textContent).toBe('closed: 1,2,3');
});
