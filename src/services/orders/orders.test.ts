// The orders' services against the memory world, and the state grouping, tested without a
// network. Each test builds its own world, so nothing leaks between them.

import memory from '@/clients/memory';

import * as orders from './index';
import { byRegion, inRegion, UNKNOWN } from './regions';
import type { Order } from './types';

function world() {
  const env = { apiUrl: '', world: 'memory' as const };
  const api = memory({ env });
  // A service takes the injection; these tests give it the one client it uses.
  return { injection: { clients: { api } } as Parameters<typeof orders.list>[0] };
}

const TWELVE = ['AZ', 'CO', 'FL', 'GA', 'IL', 'MA', 'MN', 'NY', 'OR', 'TX', 'UT', 'WA'];

test('every cart is an order, sorted by id, with the customer it ships to', async () => {
  const { injection } = world();
  const all = await orders.list(injection)();
  expect(all).toHaveLength(40);
  expect(all.map((order) => order.id)).toEqual(Array.from({ length: 40 }, (_, index) => index + 1));
  expect(all[0]).toMatchObject({ customer: { firstName: expect.any(String), id: expect.any(Number) } });
  const regions = [...new Set(all.map((order) => order.customer.address.region))].sort();
  expect(regions).toEqual(TWELVE);
});

test('an order with its lines: the lines add up to the order', async () => {
  const { injection } = world();
  const order = await orders.get(injection)(1);
  expect(order.lines.length).toBeGreaterThanOrEqual(1);
  expect(order.lines.length).toBeLessThanOrEqual(3);
  const sum = order.lines.reduce((total, line) => total + line.total, 0);
  expect(sum).toBeCloseTo(order.total, 2);
  expect(order.items).toBe(order.lines.length);
  expect((await orders.list(injection)()).find((listed) => listed.id === 1)).toMatchObject({ total: order.total });
});

test('an order that does not exist is refused', async () => {
  const { injection } = world();
  await expect(orders.get(injection)(999)).rejects.toMatchObject({ name: 'HttpError', status: 404 });
});

test('the states: 51 entries, twelve of them with orders, every order counted', async () => {
  const { injection } = world();
  const all = await orders.list(injection)();
  const tallies = byRegion(all);
  expect(tallies).toHaveLength(51);
  expect(tallies.filter((tally) => tally.orders > 0)).toHaveLength(12);
  expect(tallies.reduce((count, tally) => count + tally.orders, 0)).toBe(40);
  expect(tallies.some((tally) => tally.code === UNKNOWN)).toBe(false);
});

test('an order that ships to no known state is counted under ??', () => {
  const stray = {
    customer: {
      address: { city: '', country: '', postalCode: '', region: 'ZZ', street: '' },
      firstName: '',
      id: 0,
      lastName: '',
    },
    id: 99,
    items: 1,
    quantity: 1,
    total: 12.5,
  } satisfies Order;
  const tallies = byRegion([stray]);
  expect(tallies.at(-1)).toMatchObject({ code: UNKNOWN, orders: 1, value: 12.5 });
  expect(tallies).toHaveLength(52);
});

test('inRegion keeps the orders of one state, and all of them for an empty code', async () => {
  const { injection } = world();
  const all = await orders.list(injection)();
  expect(inRegion(all, '')).toHaveLength(40);
  const texas = inRegion(all, 'TX');
  expect(texas.length).toBeGreaterThan(0);
  expect(texas.every((order) => order.customer.address.region === 'TX')).toBe(true);
});
