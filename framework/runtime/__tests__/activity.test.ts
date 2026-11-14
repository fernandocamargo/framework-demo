import { QueryObserver } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { createElement, startTransition, Suspense, use, useState } from 'react';

import { hold, holdUntilReleased, isBusy, useCommitted, watch, whenIdle } from '../activity';
import { createQueryClient } from '../data';

const settled = async (promise: Promise<unknown>) => {
  let done = false;
  void promise.then(() => (done = true));
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 20));
  return done;
};

test('whenIdle resolves when nothing is pending', async () => {
  expect(isBusy()).toBe(false);
  await expect(settled(whenIdle())).resolves.toBe(true);
});

test('held work keeps it waiting until the work settles, failed or not', async () => {
  let fail: (error: Error) => void = () => undefined;
  const work = hold(new Promise((_, reject) => (fail = reject)));
  work.catch(() => undefined);
  const idle = whenIdle();
  expect(await settled(idle)).toBe(false);
  fail(new Error('the work failed'));
  expect(await settled(idle)).toBe(true);
});

test('a placeholder on screen keeps it waiting until it is released', async () => {
  const release = holdUntilReleased();
  const idle = whenIdle();
  expect(await settled(idle)).toBe(false);
  release();
  release();
  expect(await settled(idle)).toBe(true);
  expect(isBusy()).toBe(false);
});

test("a watched client's read keeps it waiting until the read answers", async () => {
  const client = createQueryClient();
  const stop = watch(client);
  let answer: (value: string) => void = () => undefined;
  const observer = new QueryObserver(client, {
    queryFn: () => new Promise<string>((resolve) => (answer = resolve)),
    queryKey: ['demo'],
  });
  const unsubscribe = observer.subscribe(() => undefined);
  const idle = whenIdle();
  expect(await settled(idle)).toBe(false);
  answer('done');
  expect(await settled(idle)).toBe(true);
  unsubscribe();
  stop();
  client.clear();
});

test('a value rendered in a transition keeps it waiting until React commits it', async () => {
  // The new content suspends on work nothing holds; in a transition React keeps the old content
  // on screen, with no placeholder, until it can commit the new one.
  let resume: () => void = () => undefined;
  const later = new Promise<void>((resolve) => (resume = resolve));
  function Content({ value }: { value: number }) {
    if (value === 2) use(later);
    return createElement('p', null, `value ${value}`);
  }
  let show: (value: number) => void = () => undefined;
  function Page() {
    const [value, setValue] = useState(1);
    show = setValue;
    useCommitted(value);
    return createElement(Suspense, { fallback: 'loading' }, createElement(Content, { value }));
  }
  const { container, unmount } = render(createElement(Page));
  expect(isBusy()).toBe(false);

  await act(async () => {
    startTransition(() => show(2));
  });
  expect(container.textContent).toBe('value 1');
  expect(isBusy()).toBe(true);
  const idle = whenIdle();
  expect(await settled(idle)).toBe(false);

  await act(async () => {
    resume();
    await later;
  });
  expect(container.textContent).toBe('value 2');
  expect(await settled(idle)).toBe(true);
  unmount();
});

test('a transition that goes back to the committed value stops counting', () => {
  let show: (value: number) => void = () => undefined;
  function Page() {
    const [value, setValue] = useState(1);
    show = setValue;
    useCommitted(value);
    return null;
  }
  const { unmount } = render(createElement(Page));
  act(() => {
    show(2);
    show(1);
  });
  expect(isBusy()).toBe(false);
  unmount();
  expect(isBusy()).toBe(false);
});

test('window.__framework.idle is whenIdle', () => {
  expect((window as unknown as { __framework: { idle: unknown } }).__framework.idle).toBe(whenIdle);
});
