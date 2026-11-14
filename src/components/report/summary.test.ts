// The report's arithmetic, on a small list made by hand: what each figure counts, and the order.

import type { Listed } from '@/services/products/types';

import { byCategory, lead, shortest, totals } from './summary';

const item = (id: number, fields: Partial<Listed>): Listed => ({
  category: 'desks',
  description: '',
  id,
  price: 10,
  rating: 4,
  stock: 20,
  thumbnail: '',
  title: `Product ${id}`,
  version: 1,
  ...fields,
});

const list = [
  item(1, { category: 'lighting', price: 30, stock: 0, title: 'Lamp A' }),
  item(2, { category: 'lighting', price: 50, stock: 4, title: 'Lamp B' }),
  item(3, { category: 'lighting', price: 40, stock: 100, title: 'Lamp C' }),
  item(4, { category: 'desks', price: 200, stock: 2, title: 'Desk' }),
  item(5, { category: 'audio', price: 5, stock: 5, title: 'Cable' }),
];

test('the totals count units, value, out and low, where low is at most five units', () => {
  expect(totals(list)).toEqual({
    low: 3,
    out: 1,
    products: 5,
    units: 111,
    value: 4625,
  });
  expect(totals([])).toEqual({ low: 0, out: 0, products: 0, units: 0, value: 0 });
});

test('a category row sums its own products and their price range', () => {
  const [top] = byCategory(list);
  expect(top).toEqual({
    category: 'lighting',
    high: 50,
    low: 1,
    lowest: 30,
    out: 1,
    products: 3,
    units: 104,
    value: 4200,
  });
});

test('categories are ordered by value, most valuable first', () => {
  expect(byCategory(list).map((row) => row.category)).toEqual(['lighting', 'desks', 'audio']);
});

test('the shortest are the least stocked, ties by title, and no more than ten', () => {
  expect(shortest(list).map((product) => product.title)).toEqual(['Lamp A', 'Desk', 'Lamp B', 'Cable', 'Lamp C']);
  const many = Array.from({ length: 14 }, (_, index) => item(index + 1, { stock: index }));
  expect(shortest(many)).toHaveLength(10);
  expect(shortest(many)[0]).toMatchObject({ id: 1, stock: 0 });
});

test('anything out of stock leads the headline, counted', () => {
  expect(lead(list)).toEqual({ count: 1, kind: 'out' });
});

test('with nothing out, the category with most low products leads', () => {
  const low = [
    item(1, { category: 'audio', stock: 2 }),
    item(2, { category: 'desks', stock: 1 }),
    item(3, { category: 'desks', stock: 3 }),
    item(4, { category: 'lighting', stock: 50 }),
  ];
  expect(lead(low)).toEqual({ category: 'desks', count: 2, kind: 'low' });
});

test('a tie between categories goes to the more valuable one', () => {
  const tied = [
    item(1, { category: 'audio', price: 10, stock: 1 }),
    item(2, { category: 'desks', price: 100, stock: 1 }),
  ];
  expect(lead(tied)).toEqual({ category: 'desks', count: 1, kind: 'low' });
});

test('with nothing out or low, the headline is calm', () => {
  expect(lead([item(1, { stock: 6 })])).toEqual({ kind: 'calm' });
  expect(lead([])).toEqual({ kind: 'calm' });
});
