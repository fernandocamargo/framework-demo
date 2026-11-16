// The search child's chart, with a search the test controls.

import type { Listed } from '@/services/products/types';
import { startFlow } from 'framework/testing';

import * as searchChart from './state';

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
  const flow = startFlow(searchChart, { services: { products: { search } } });
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
  const flow = startFlow(searchChart, { services: { products: { search } } });
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
  const flow = startFlow(searchChart, { services: { products: { search } } });
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

test('unmounting and reopening starts with no text or results', async () => {
  const flow = startFlow(searchChart, { services: { products: { search: async () => page(found) } } });
  flow.send({ text: 'lamp', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);
  flow.stop();
  const reopened = startFlow(searchChart, { services: { products: { search: async () => page(found) } } });
  expect(reopened.states).toEqual(['idle']);
  expect(reopened.context).toEqual({ results: [], text: '' });
  reopened.stop();
});

test('unmounting during the pause never starts a search', async () => {
  const search = vi.fn(async () => page(found));
  const flow = startFlow(searchChart, { services: { products: { search } } });
  flow.send({ text: 'lamp', type: 'typed' });
  flow.stop();
  await vi.advanceTimersByTimeAsync(300);
  expect(search).not.toHaveBeenCalled();
});

test('a late answer after unmount is not used by a reopened search', async () => {
  let answer: (value: ReturnType<typeof page>) => void = () => undefined;
  const search = vi.fn(() => new Promise<ReturnType<typeof page>>((resolve) => (answer = resolve)));
  const flow = startFlow(searchChart, { services: { products: { search } } });
  flow.send({ text: 'lamp', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);
  expect(flow.states).toEqual(['searching']);
  flow.stop();
  const reopened = startFlow(searchChart, { services: { products: { search } } });
  answer(page(found));
  await vi.advanceTimersByTimeAsync(0);
  expect(reopened.context).toEqual({ results: [], text: '' });
  reopened.stop();
});

test('a failed search returns to idle and keeps the previous results', async () => {
  const search = vi.fn().mockResolvedValueOnce(page(found)).mockRejectedValueOnce(new Error('unavailable'));
  const flow = startFlow(searchChart, { services: { products: { search } } });
  flow.send({ text: 'lamp', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);
  expect(flow.context['results']).toEqual(found);
  flow.send({ text: 'lamps', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);
  expect(flow.states).toEqual(['idle']);
  expect(flow.context['results']).toEqual(found);
  flow.stop();
});

test('at most six products are kept', async () => {
  const many = Array.from({ length: 8 }, (_, id) => lamp(id, `Lamp ${id}`));
  const flow = startFlow(searchChart, { services: { products: { search: async () => page(many) } } });
  flow.send({ text: 'lamp', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);
  expect(flow.context['results']).toEqual(many.slice(0, 6));
  flow.stop();
});

test('the two-character threshold and query use trimmed text', async () => {
  const search = vi.fn(async () => page(found));
  const flow = startFlow(searchChart, { services: { products: { search } } });
  flow.send({ text: ' l ', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);
  expect(search).not.toHaveBeenCalled();

  flow.send({ text: ' la ', type: 'typed' });
  await vi.advanceTimersByTimeAsync(300);
  expect(search).toHaveBeenCalledWith({ category: '', order: 'asc', page: 1, q: 'la', sort: 'title' });
  flow.stop();
});
