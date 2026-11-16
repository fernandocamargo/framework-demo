import { vi } from 'vitest';

import { pickCategory, pickSort } from './handlers';

test.each([
  ['price:desc', 'price', 'desc'],
  ['price:asc', 'price', 'asc'],
  ['title:asc', 'title', 'asc'],
  ['rating:desc', 'rating', 'desc'],
  ['stock:asc', 'stock', 'asc'],
] as const)('a native sort change to %s writes both address fields and returns to page one', (value, sort, order) => {
  const query = vi.fn();
  // SAFETY: The handler reads only navigation.query and the select's current value.
  pickSort({ navigation: { query } } as never)({ currentTarget: { value } } as never);

  expect(query).toHaveBeenCalledExactlyOnceWith('/products', { order, page: 1, sort });
});

test.each([
  ['all', ''],
  ['lighting', 'lighting'],
])('a native category change to %s returns to page one', (value, category) => {
  const query = vi.fn();
  // SAFETY: The handler reads only navigation.query and the select's current value.
  pickCategory({ navigation: { query } } as never)({ currentTarget: { value } } as never);

  expect(query).toHaveBeenCalledExactlyOnceWith('/products', { category, page: 1 });
});
