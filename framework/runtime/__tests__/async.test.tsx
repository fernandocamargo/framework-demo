import { act, renderHook } from '@testing-library/react';

import { type AsyncModule, execute, type Operation, useOperations } from '../async';
import { type Failure, onFailure } from '../pipeline';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
/** The state an operation carries. */
const stateOf = ({ data, error, pending }: Operation) => ({ data, error, pending });
const injection = {};

test('an export that throws before it returns a promise fails as a rejection', async () => {
  const thrown = new Error('before the promise');
  let promise: Promise<unknown> | undefined;
  expect(() => {
    promise = execute(
      () => {
        throw thrown;
      },
      {},
      [],
    );
  }).not.toThrow();
  await expect(promise).rejects.toBe(thrown);
});

test('an operation keeps its identity while its state changes, and carries that state', async () => {
  const failures: Failure[] = [];
  const stop = onFailure((failure) => failures.push(failure));
  const calls: { reject: (error: Error) => void; resolve: (value: unknown) => void }[] = [];
  const module: AsyncModule = {
    save: () => () => new Promise((resolve, reject) => calls.push({ reject, resolve })),
  };
  const { result } = renderHook(() => useOperations('components/demo', module, injection));
  const save = result.current.save!;
  expect(stateOf(save)).toEqual({ data: undefined, error: undefined, pending: false });

  let call: Promise<unknown> | undefined;
  let record = result.current;
  act(() => {
    call = save();
  });
  // Every change of state is a new record of operations, with the same operation in it.
  expect(result.current).not.toBe(record);
  expect(result.current.save).toBe(save);
  expect(save.pending).toBe(true);

  record = result.current;
  await act(async () => {
    calls[0]!.resolve('saved');
    await call;
  });
  expect(result.current).not.toBe(record);
  expect(result.current.save).toBe(save);
  expect(stateOf(save)).toEqual({ data: 'saved', error: undefined, pending: false });

  // A failure keeps the data the operation had, and is reported once.
  act(() => {
    call = save().catch(() => undefined);
  });
  await act(async () => {
    calls[1]!.reject(new Error('refused'));
    await call;
  });
  expect(result.current.save).toBe(save);
  expect(stateOf(save)).toMatchObject({ data: 'saved', pending: false });
  expect(save.error?.message).toBe('refused');
  expect(failures.filter((failure) => failure.error.message === 'refused')).toHaveLength(1);

  // The next call clears the error.
  act(() => void save());
  expect(result.current.save).toBe(save);
  expect(stateOf(save)).toMatchObject({ error: undefined, pending: true });
  stop();
});

test("an operation runs its export with the injection, a signal and the call's arguments, and answers its caller", async () => {
  const services = { products: {} };
  const given = { services };
  const received: unknown[] = [];
  const module: AsyncModule = {
    add:
      ({ services, signal }: { services: unknown; signal: AbortSignal }) =>
      (a: number, b: number) => {
        received.push(services, signal instanceof AbortSignal);
        return Promise.resolve(a + b);
      },
    // An export may also return the promise itself, with no arguments to take.
    ping: () => Promise.resolve('pong'),
  };
  const { result } = renderHook(() => useOperations('components/demo', module, given));

  let sum: Promise<unknown> | undefined;
  let pong: Promise<unknown> | undefined;
  await act(async () => {
    sum = result.current.add!(2, 3);
    pong = result.current.ping!();
    await Promise.all([sum, pong]);
  });
  await expect(sum).resolves.toBe(5);
  await expect(pong).resolves.toBe('pong');
  expect(received).toEqual([services, true]);
  expect(result.current.add?.data).toBe(5);
  expect(result.current.ping?.data).toBe('pong');
});

test('an operation runs with the injection it was made with: the same one keeps it, a new one makes another', async () => {
  const module: AsyncModule = { who: ({ name }: { name: string }) => Promise.resolve(name) };
  const first = { name: 'first' };
  const { rerender, result } = renderHook(({ given }) => useOperations('components/demo', module, given), {
    initialProps: { given: first },
  });
  const made = result.current.who!;

  rerender({ given: first });
  expect(result.current.who).toBe(made);

  rerender({ given: { name: 'second' } });
  expect(result.current.who).not.toBe(made);
  let answer: Promise<unknown> | undefined;
  await act(async () => {
    answer = result.current.who!();
    await answer;
  });
  await expect(answer).resolves.toBe('second');
});

test('an operation that throws before it returns a promise ends with its error, reported once', async () => {
  const failures: Failure[] = [];
  const stop = onFailure((failure) => failures.push(failure));
  const module: AsyncModule = {
    save: () => {
      throw new Error('thrown at once');
    },
  };
  const { result } = renderHook(() => useOperations('components/demo', module, injection));

  await act(async () => {
    await result.current.save?.().catch(() => undefined);
  });
  await flush();
  stop();

  expect(result.current.save?.pending).toBe(false);
  expect(result.current.save?.error?.message).toBe('thrown at once');
  expect(failures.filter((failure) => failure.error.message === 'thrown at once')).toHaveLength(1);
});

test("an operation's latest call sets its state, whichever call answers last", async () => {
  const answers = new Map<unknown, (value: unknown) => void>();
  const module: AsyncModule = {
    load: () => (id: unknown) => new Promise((resolve) => answers.set(id, resolve)),
  };
  const { result } = renderHook(() => useOperations('components/demo', module, injection));

  let first: Promise<unknown> | undefined;
  let second: Promise<unknown> | undefined;
  act(() => {
    first = result.current.load?.('a');
  });
  act(() => {
    second = result.current.load?.('b');
  });
  await act(async () => {
    answers.get('b')?.('answer b');
    await second;
  });
  expect(result.current.load?.data).toBe('answer b');

  await act(async () => {
    answers.get('a')?.('answer a');
    await first;
  });
  expect(result.current.load?.data).toBe('answer b');
  expect(result.current.load?.pending).toBe(false);
  // The earlier call still answers its own caller.
  await expect(first).resolves.toBe('answer a');
});

test('an operation that answers after its component left sets no state, and still answers its caller', async () => {
  let answer: ((value: unknown) => void) | undefined;
  let signal: AbortSignal | undefined;
  const module: AsyncModule = {
    load: (given: { signal: AbortSignal }) => {
      signal = given.signal;
      return new Promise((resolve) => (answer = resolve));
    },
  };
  const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const { result, unmount } = renderHook(() => useOperations('components/demo', module, injection));

  let call: Promise<unknown> | undefined;
  act(() => {
    call = result.current.load?.();
  });
  expect(result.current.load?.pending).toBe(true);
  const shown = result.current;

  unmount();
  expect(signal?.aborted).toBe(true);
  answer?.('late');
  await expect(call).resolves.toBe('late');
  await flush();

  // What the component last showed is what it was left with, and React had nothing to say.
  expect(result.current).toBe(shown);
  expect(result.current.load?.pending).toBe(true);
  expect(complaints).not.toHaveBeenCalled();
  complaints.mockRestore();
});
