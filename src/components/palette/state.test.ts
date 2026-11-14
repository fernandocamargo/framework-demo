// The palette's chart, with a search the test controls.

import type { Listed } from '@/services/products/types';
import { startFlow } from 'framework/testing';

import * as palette from './state';

const lamp = (id: number, title: string): Listed => ({
  category: 'lighting',
  description: '',
  id,
  price: 10,
  rating: 4,
  stock: 1,
  thumbnail: '',
  title,
  version: 1,
});
const found = [lamp(22, 'Arc Floor Lamp'), lamp(23, 'Clamp Lamp'), lamp(24, 'Task Lamp')];
const page = (items: Listed[]) => ({ items, page: 1, pages: 1, total: items.length });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test('typing quickly searches once, for the last text, after the pause', async () => {
  const search = vi.fn(async () => page(found));
  const flow = startFlow(palette, { services: { products: { search } } });
  flow.send({ type: 'open' });
  flow.send({ text: 'la', type: 'typed' });
  await vi.advanceTimersByTimeAsync(100);
  flow.send({ text: 'lam', type: 'typed' });
  await vi.advanceTimersByTimeAsync(100);
  flow.send({ text: 'lamp', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);

  expect(search).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenCalledWith({ category: '', order: 'asc', page: 1, q: 'lamp', sort: 'title' });
  expect(flow.states).toEqual(['idle']);
  expect(flow.context['results']).toEqual(found);
  flow.stop();
});

test('one character does not search, and what was found before goes', async () => {
  const search = vi.fn(async () => page(found));
  const flow = startFlow(palette, { services: { products: { search } } });
  flow.send({ type: 'open' });
  flow.send({ text: 'lamp', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);
  expect(flow.context['results']).toEqual(found);

  flow.send({ text: 'l', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);
  expect(search).toHaveBeenCalledTimes(1);
  expect(flow.states).toEqual(['idle']);
  expect(flow.context['results']).toEqual([]);
  flow.stop();
});

test('an answer that comes after the person typed on is dropped', async () => {
  let answer: (value: ReturnType<typeof page>) => void = () => undefined;
  const search = vi.fn(() => new Promise<ReturnType<typeof page>>((resolve) => (answer = resolve)));
  const flow = startFlow(palette, { services: { products: { search } } });
  flow.send({ type: 'open' });
  flow.send({ text: 'lamp', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);
  expect(flow.states).toEqual(['searching']);

  flow.send({ text: 'lamps', type: 'typed' });
  expect(flow.states).toEqual(['waiting']);
  answer(page(found));
  await vi.advanceTimersByTimeAsync(0);
  expect(flow.states).toEqual(['waiting']);
  expect(flow.context['results']).toEqual([]);
  flow.stop();
});

test('closing empties what was typed and what was found', async () => {
  const flow = startFlow(palette, { services: { products: { search: async () => page(found) } } });
  flow.send({ type: 'open' });
  flow.send({ text: 'lamp', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);
  flow.send({ type: 'close' });
  expect(flow.states).toEqual(['closed']);
  expect(flow.context).toEqual({ results: [], text: '' });
  flow.stop();
});
