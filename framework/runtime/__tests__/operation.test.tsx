import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { useActorRef, useMachine, useSelector } from '@xstate/react';
import { Activity, createElement, startTransition, StrictMode, Suspense } from 'react';
import { initialTransition, type SnapshotFrom, transition } from 'xstate';

import { isBusy } from '../activity';
import { useOperation, useOperations } from '../async';
import { shareByIdentity } from '../data';
import { latency } from '../latency';
import { onFailure, report } from '../pipeline';

const injection = {};

const controlled = () => {
  const calls: {
    args: unknown[];
    reject: (reason?: Error) => void;
    resolve: (value: number) => void;
    signal: AbortSignal;
  }[] = [];

  const exported =
    ({ signal }: { signal: AbortSignal }) =>
    (...args: unknown[]) => {
      let resolve!: (value: number) => void;
      let reject!: (reason?: Error) => void;

      const promise = new Promise<number>((yes, no) => {
        resolve = yes;
        reject = no;
      });

      calls.push({ args, reject, resolve, signal });

      return promise;
    };

  return { calls, exported };
};

const useSave = <Result,>(exported: (injection: { signal: AbortSignal }) => Result) =>
  useOperation('components/example', 'save', exported, injection);

const pending = (snapshot: SnapshotFrom<typeof latency>) => snapshot.matches('pending');

afterEach(() => {
  cleanup();
  expect(isBusy()).toBe(false);
});

test('the pure machine accepts outcomes only while pending and only for the latest call', () => {
  const first = new AbortController();
  const second = new AbortController();
  const [idle] = initialTransition(latency);
  const [unexpected] = transition(latency, idle, { call: first, data: 0, type: 'RESOLVE' });
  expect(unexpected).toBe(idle);
  const [watching] = transition(latency, idle, { call: first, type: 'WATCH' });
  const [newer] = transition(latency, watching, { call: second, type: 'WATCH' });
  const [older] = transition(latency, newer, { call: first, data: 1, type: 'RESOLVE' });
  expect(older).toBe(newer);
  const [saved] = transition(latency, newer, { call: second, data: 2, type: 'RESOLVE' });
  expect(saved.matches('fulfilled')).toBe(true);
  const [retry] = transition(latency, saved, { call: first, type: 'WATCH' });
  const error = new Error('refused');
  const [failed] = transition(latency, retry, { call: first, error, type: 'REJECT' });
  expect(failed.matches('rejected')).toBe(true);
  expect(failed.context).toMatchObject({ data: 2, error });
  const [again] = transition(latency, failed, { call: second, type: 'WATCH' });
  expect(again.context).toMatchObject({ data: 2, error: undefined });
  const [aborted] = transition(latency, again, { call: second, type: 'ABORT' });
  expect(aborted.matches('rejected')).toBe(true);
  expect(aborted.context.error).toBe(error);
});

test('a React-owned actor drops an older outcome without stranding or aborting its caller', async () => {
  const { calls, exported } = controlled();
  const { result } = renderHook(() => useSave(exported));
  const [save, actor] = result.current;
  const events: string[] = [];

  const inspection = actor.system.inspect((event) => {
    if (event.type === '@xstate.event' && event.actorRef === actor) events.push(event.event.type);
  });

  const first = save('first');
  const second = save('second');
  calls[1]!.resolve(2);
  await expect(second).resolves.toBe(2);
  expect(actor.getSnapshot().context.data).toBe(2);
  expect(isBusy()).toBe(true);
  calls[0]!.resolve(1);
  await expect(first).resolves.toBe(1);
  expect(events.filter((event) => event === 'RESOLVE')).toHaveLength(2);
  expect(actor.getSnapshot().context.running).toEqual([]);
  expect(calls.map((call) => call.signal.aborted)).toEqual([false, false]);
  expect(Object.hasOwn(save, 'pending')).toBe(false);
  inspection.unsubscribe();
});

test('the latest call stays visible when the older call settles first', async () => {
  const { calls, exported } = controlled();
  const { result } = renderHook(() => useSave(exported));
  const [save, actor] = result.current;
  const first = save('first');
  const second = save('second');
  calls[0]!.resolve(1);
  await expect(first).resolves.toBe(1);
  expect(actor.getSnapshot().matches('pending')).toBe(true);
  expect(actor.getSnapshot().context.data).toBeUndefined();
  expect(isBusy()).toBe(true);
  calls[1]!.resolve(2);
  await expect(second).resolves.toBe(2);
  expect(actor.getSnapshot().matches('fulfilled')).toBe(true);
  expect(actor.getSnapshot().context.data).toBe(2);
  expect(isBusy()).toBe(false);
});

test('an earlier failure is reported once while the current call remains pending', async () => {
  const failures: Error[] = [];
  const off = onFailure((failure) => failures.push(failure.error));
  const { calls, exported } = controlled();
  const { result } = renderHook(() => useSave(exported));
  const [save, actor] = result.current;
  const first = save();
  const second = save();
  const error = report(new Error('earlier failed'), { layer: 'service', path: 'services/example' });
  calls[0]!.reject(error);
  await expect(first).rejects.toBe(error);
  expect(actor.getSnapshot().matches('pending')).toBe(true);
  expect(actor.getSnapshot().context.error).toBeUndefined();
  calls[1]!.resolve(2);
  await second;
  expect(failures.filter((failure) => failure === error)).toHaveLength(1);
  off();
});

test('a synchronous failure rejects its caller and is reported once', async () => {
  const failures: Error[] = [];
  const off = onFailure((failure) => failures.push(failure.error));
  const error = new Error('before the promise');

  const { result } = renderHook(() =>
    useSave(() => {
      throw error;
    }),
  );

  await expect(result.current[0]()).rejects.toBe(error);
  await Promise.resolve();
  expect(result.current[1].getSnapshot().matches('rejected')).toBe(true);
  expect(failures.filter((failure) => failure === error)).toHaveLength(1);
  off();
});

test('the command stays stable and a new injection changes only future calls', async () => {
  const exported = ({ label }: { label: string }) => Promise.resolve(label);
  const first = { label: 'first' };

  const { rerender, result } = renderHook(({ given }) => useOperation('example', 'save', exported, given), {
    initialProps: { given: first },
  });

  const [before, actor] = result.current;
  rerender({ given: first });
  expect(result.current[0]).toBe(before);
  rerender({ given: { label: 'second' } });
  expect(result.current[1]).toBe(actor);
  expect(result.current[0]).not.toBe(before);
  await expect(before()).resolves.toBe('first');
  await expect(result.current[0]()).resolves.toBe('second');
});

test('a command-only folder no longer renders on start or settlement', async () => {
  const baseline = controlled();
  const proposed = controlled();
  const module = { save: baseline.exported };
  let oldRenders = 0;
  let newRenders = 0;

  const old = renderHook(() => {
    oldRenders++;

    return useOperations('example', module, injection).save!;
  });

  const next = renderHook(() => {
    newRenders++;

    return useSave(proposed.exported)[0];
  });

  let first: Promise<unknown>;
  let second: Promise<unknown>;
  act(() => {
    first = old.result.current();
    second = next.result.current();
  });
  await act(async () => {
    baseline.calls[0]!.resolve(1);
    proposed.calls[0]!.resolve(1);
    await Promise.all([first, second]);
  });
  expect({ newRenders, oldRenders }).toEqual({ newRenders: 1, oldRenders: 3 });
});

test('a leaf selects pending without rendering for a second WATCH or FINISH bookkeeping', async () => {
  const { calls, exported } = controlled();
  let renders = 0;

  const { result } = renderHook(() => {
    renders++;
    const [save, actor] = useSave(exported);

    return { actor, pending: useSelector(actor, pending), save };
  });

  let first: Promise<unknown>;
  let second: Promise<unknown>;
  act(() => {
    first = result.current.save();
  });
  expect(result.current.pending).toBe(true);
  act(() => {
    second = result.current.save();
  });
  expect(renders).toBe(2);
  await act(async () => {
    calls[0]!.resolve(1);
    await first;
  });
  expect(renders).toBe(2);
  await act(async () => {
    calls[1]!.resolve(2);
    await second;
  });
  expect(result.current.pending).toBe(false);
  expect(renders).toBe(3);
});

test('useMachine subscribes to the whole snapshot even when the caller ignores it', () => {
  let renders = 0;

  const { result } = renderHook(() => {
    renders++;

    return useMachine(latency)[2];
  });

  act(() => {
    result.current.send({ call: new AbortController(), type: 'WATCH' });
  });
  expect(renders).toBe(2);
});

test('unmount aborts every signal and caller promises still settle independently', async () => {
  const { calls, exported } = controlled();
  const { result, unmount } = renderHook(() => useSave(exported));
  const first = result.current[0]();
  const second = result.current[0]();
  unmount();
  expect(calls.map((call) => call.signal.aborted)).toEqual([true, true]);
  calls[0]!.resolve(1);
  calls[1]!.resolve(2);
  await expect(first).resolves.toBe(1);
  await expect(second).resolves.toBe(2);
});

test('XState stopping a watcher alone does not abort the external call', () => {
  const call = new AbortController();
  const { result, unmount } = renderHook(() => useActorRef(latency));
  act(() => {
    result.current.send({ call, type: 'WATCH' });
  });
  unmount();
  expect(call.signal.aborted).toBe(false);
});

test('an abort-aware call rejects without reporting a failure', async () => {
  const failures: Error[] = [];
  const off = onFailure((failure) => failures.push(failure.error));
  const error = new Error('aborted');

  const exported = ({ signal }: { signal: AbortSignal }) =>
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(error), { once: true });
    });

  const { result, unmount } = renderHook(() => useSave(exported));
  const call = result.current[0]();
  unmount();
  await expect(call).rejects.toBe(error);
  expect(failures.filter((failure) => failure === error)).toHaveLength(0);
  off();
});

test('StrictMode does not invoke work and leaves the live command usable', async () => {
  const { calls, exported } = controlled();
  const { result } = renderHook(() => useSave(exported), { wrapper: StrictMode });
  expect(calls).toHaveLength(0);
  const call = result.current[0]();
  expect(calls).toHaveLength(1);
  expect(calls[0]!.signal.aborted).toBe(false);
  calls[0]!.resolve(1);
  await call;
});

test('a hidden subtree aborts signals without replaying its externally watched promise', async () => {
  const { calls, exported } = controlled();

  function Leaf() {
    const [save, actor] = useSave(exported);

    return createElement(
      'button',
      { onClick: () => void save() },
      String(useSelector(actor, (snapshot) => snapshot.value)),
    );
  }

  const tree = (mode: 'hidden' | 'visible') => createElement(Activity, { children: createElement(Leaf), mode });
  const view = render(tree('visible'));
  act(() => {
    fireEvent.click(view.getByRole('button'));
  });
  view.rerender(tree('hidden'));
  expect(calls[0]!.signal.aborted).toBe(true);
  await act(async () => {
    calls[0]!.resolve(1);
    await Promise.resolve();
  });
  view.rerender(tree('visible'));
  expect(view.container.textContent).toBe('idle');
  expect(calls).toHaveLength(1);
});

test('hiding an abort-aware call restores the last settled status without a failure', async () => {
  const failures: Error[] = [];
  const off = onFailure((failure) => failures.push(failure.error));
  const reason = new Error('aborted');
  let calls = 0;

  const exported = ({ signal }: { signal: AbortSignal }) => {
    calls++;

    if (calls === 1) return Promise.resolve(7);

    return new Promise<number>((_, reject) => {
      signal.addEventListener('abort', () => reject(reason), { once: true });
    });
  };

  function Leaf() {
    const [save, actor] = useSave(exported);
    const phase = useSelector(actor, (snapshot) => snapshot.value);
    const data = useSelector(actor, (snapshot) => snapshot.context.data);

    return createElement('button', { onClick: () => void save() }, `${phase}:${data ?? 'none'}`);
  }

  const tree = (mode: 'hidden' | 'visible') => createElement(Activity, { children: createElement(Leaf), mode });
  const view = render(tree('visible'));
  await act(async () => {
    fireEvent.click(view.getByRole('button'));
    await Promise.resolve();
  });
  expect(view.getByRole('button').textContent).toBe('fulfilled:7');

  fireEvent.click(view.getByRole('button'));
  expect(view.getByRole('button').textContent).toBe('pending:7');
  view.rerender(tree('hidden'));
  await act(async () => Promise.resolve());
  view.rerender(tree('visible'));

  expect(view.getByRole('button').textContent).toBe('fulfilled:7');
  expect(failures).toEqual([]);
  expect(calls).toBe(2);
  off();
});

test('an abandoned transition does not publish its command injection to the visible button', async () => {
  const calls: string[] = [];

  const exported = ({ label }: { label: string }) => {
    calls.push(label);

    return Promise.resolve(label);
  };

  const never = new Promise(() => undefined);

  function Owner({ given, suspended }: { given: { label: string }; suspended: boolean }) {
    const [save] = useOperation('example', 'save', exported, given);

    if (suspended) throw never;

    return createElement('button', { onClick: () => void save() }, 'Save');
  }

  const tree = (label: string, suspended: boolean) =>
    createElement(Suspense, { fallback: 'Loading' }, createElement(Owner, { given: { label }, suspended }));

  const view = render(tree('committed', false));
  act(() => {
    startTransition(() => view.rerender(tree('discarded', true)));
  });
  await act(async () => {
    fireEvent.click(view.getByText('Save'));
    await Promise.resolve();
  });
  expect(calls).toEqual(['committed']);
  view.rerender(tree('committed', false));
});

test('a follower reads its explicit actor while the owning folder stays still', async () => {
  const { calls, exported } = controlled();
  let ownerRenders = 0;
  let leafRenders = 0;

  function Follower({ source }: { source: ReturnType<typeof useSave>[1] }) {
    leafRenders++;

    return createElement('output', null, String(useSelector(source, pending)));
  }

  function Owner() {
    ownerRenders++;
    const [save, actor] = useSave(exported);

    return createElement('button', { onClick: () => void save() }, createElement(Follower, { source: actor }));
  }

  const view = render(createElement(Owner));
  act(() => {
    fireEvent.click(view.getByRole('button'));
  });
  expect(view.container.textContent).toBe('true');
  await act(async () => {
    calls[0]!.resolve(1);
    await Promise.resolve();
  });
  expect({ leafRenders, ownerRenders }).toEqual({ leafRenders: 3, ownerRenders: 1 });
});

test('a frozen source has a prototype and passes sharing and selection without being dismantled', () => {
  class Frozen {
    constructor(readonly snapshot: SnapshotFrom<typeof latency>) {
      Object.freeze(this);
    }
    getSnapshot = () => this.snapshot;
    subscribe = () => ({ unsubscribe() {} });
  }

  const [initial] = initialTransition(latency);
  const source = new Frozen(latency.resolveState({ context: initial.context, value: 'pending' }));
  const previous = { source };
  expect(shareByIdentity(previous, { source })).toBe(previous);

  function Follower() {
    return String(useSelector(source, pending));
  }

  expect(render(createElement(Follower)).container.textContent).toBe('true');
});
