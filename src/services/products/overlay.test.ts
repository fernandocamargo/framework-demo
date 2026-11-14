import type { Overlay } from '@/clients/local';

import { laid, layPage, matches } from './overlay';
import type { Product, Query } from './types';

const product = (id: number, fields: Partial<Product> = {}) => ({
  category: 'desks',
  description: '',
  id,
  price: 10,
  rating: 4,
  stock: 3,
  thumbnail: '',
  title: `Product ${id}`,
  ...fields,
});
const query: Query = { category: '', order: 'asc', page: 1, q: '', sort: 'title' };
const nothing: Overlay = { created: [], edits: {}, removed: [] };

test('an untouched product is at version 1 and carries no mark', () => {
  expect(laid(product(1), nothing)).toEqual({ ...product(1), version: 1 });
});

test('an edit lies over the product, with its version', () => {
  const overlay: Overlay = { ...nothing, edits: { 1: { changes: { price: 8 }, version: 3 } } };
  expect(laid(product(1), overlay)).toMatchObject({ local: 'edited', price: 8, version: 3 });
});

test('a page loses its deleted products and shows the created ones first, on page 1 only', () => {
  const created: Product = { ...product(10_001, { title: 'Made here' }), images: [], reviews: [] };
  const overlay: Overlay = { created: [created], edits: {}, removed: [2] };
  const remote = { items: [product(1), product(2), product(3)], total: 30 };

  const first = layPage(remote, overlay, query, 12);
  expect(first.items.map((item) => item.id)).toEqual([10_001, 1, 3]);
  expect(first.items[0]).toMatchObject({ local: 'created', version: 1 });
  expect(first.total).toBe(30);
  expect(first.pages).toBe(3);

  const second = layPage(remote, overlay, { ...query, page: 2 }, 12);
  expect(second.items.map((item) => item.id)).toEqual([1, 3]);
});

test('a created product shows only in the lists it matches', () => {
  const created: Product = {
    ...product(10_001, { category: 'desks', title: 'Cork Coaster' }),
    images: [],
    reviews: [],
  };
  const overlay: Overlay = { ...nothing, created: [created] };
  const remote = { items: [], total: 0 };
  expect(layPage(remote, overlay, { ...query, category: 'audio' }, 12).items).toEqual([]);
  expect(layPage(remote, overlay, { ...query, q: 'cork' }, 12).items).toHaveLength(1);
  expect(matches(created, { category: 'desks', q: 'COASTER' })).toBe(true);
});
