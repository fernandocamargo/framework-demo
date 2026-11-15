// The memory world's list answers, from the helper and from the same wire the client uses.

import { carts, customers, products } from './fixtures';
import { createServer, listing } from './server';

const items = [
  { id: 2, name: 'Zulu', price: 8 },
  { id: 1, name: 'Alpha', price: 3 },
  { id: 3, name: 'Beta', price: 5 },
];
const query = (text: string) => new URLSearchParams(text);

test('the list helper pages, selects known fields, and keeps the total before paging', () => {
  expect(listing('users', items, query('skip=1&limit=1&select=name,missing'))).toEqual({
    limit: 1,
    skip: 1,
    total: 3,
    users: [{ id: 1, name: 'Alpha' }],
  });
  expect(listing('users', items, query('limit=0&skip=1'))).toEqual({
    limit: 2,
    skip: 1,
    total: 3,
    users: items.slice(1),
  });
  expect(listing('users', items, query('skip=9'))).toEqual({ limit: 0, skip: 9, total: 3, users: [] });
});

test('the list helper sorts before paging and leaves an unknown sort field in source order', () => {
  expect(listing('products', items, query('sortBy=name&order=desc&limit=2'), true)).toEqual({
    limit: 2,
    products: [items[0], items[2]],
    skip: 0,
    total: 3,
  });
  expect(listing('products', items, query('sortBy=missing&limit=2'), true).products).toEqual(items.slice(0, 2));
  expect(listing('carts', items, query('sortBy=name&order=desc'))).toEqual({
    carts: items,
    limit: 3,
    skip: 0,
    total: 3,
  });
});

const server = createServer();
const get = async (path: string) => (await server(`http://memory.invalid${path}`, { method: 'GET' })).json();

test('products, search, and category routes use the same paging, sorting, and selection', async () => {
  expect(await get('/products?sortBy=id&order=desc&limit=2&select=title,missing')).toEqual({
    limit: 2,
    products: [
      { id: 40, title: 'Headphone Hook' },
      { id: 39, title: 'Pegboard Panel' },
    ],
    skip: 0,
    total: products.length,
  });
  expect(await get('/products/search?q=lamp&sortBy=title&skip=1&limit=1&select=title')).toEqual({
    limit: 1,
    products: [{ id: 28, title: 'Clamp Lamp' }],
    skip: 1,
    total: 3,
  });
  const category = await get('/products/category/lighting?sortBy=id&order=desc&limit=0&select=title');
  expect(category).toMatchObject({ limit: 9, skip: 0, total: 9 });
  expect(category.products).toHaveLength(9);
  expect(category.products.slice(0, 2)).toEqual([
    { id: 29, title: 'Paper Lantern' },
    { id: 28, title: 'Clamp Lamp' },
  ]);
});

test('cart and user routes keep their list shapes at the edges', async () => {
  expect(await get('/carts?skip=39&limit=1&select=userId,missing')).toEqual({
    carts: [{ id: 40, userId: 117 }],
    limit: 1,
    skip: 39,
    total: carts.length,
  });
  expect(await get('/carts?limit=0')).toEqual({ carts, limit: carts.length, skip: 0, total: carts.length });
  expect(await get('/users?skip=99')).toEqual({ limit: 0, skip: 99, total: customers.length, users: [] });
  expect(await get('/users?sortBy=firstName&order=desc&limit=1&select=firstName,missing')).toEqual({
    limit: 1,
    skip: 0,
    total: customers.length,
    users: [{ firstName: 'Leo', id: 112 }],
  });
  expect(await get('/products?sortBy=missing&limit=1&select=title')).toEqual({
    limit: 1,
    products: [{ id: 1, title: 'Studio Monitor' }],
    skip: 0,
    total: products.length,
  });
});
