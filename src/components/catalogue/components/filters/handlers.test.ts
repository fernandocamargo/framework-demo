import { vi } from 'vitest';

import { pickCategory, pickSort } from './handlers';

test.each([
  ['price:desc', 'price', 'desc'],
  ['price:asc', 'price', 'asc'],
  ['title:asc', 'title', 'asc'],
  ['rating:desc', 'rating', 'desc'],
  ['stock:asc', 'stock', 'asc'],
] as const)('a native sort change to %s writes both address fields and returns to page one', (value, sort, order) => {
  const go = vi.fn();
  // SAFETY: The handler reads only navigation.go and the select's current value.
  pickSort({ navigation: { go } } as never)({ currentTarget: { value } } as never);

  expect(go).toHaveBeenCalledExactlyOnceWith({ order, page: 1, sort });
});

test.each([
  ['all', ''],
  ['lighting', 'lighting'],
])('a native category change to %s returns to page one', (value, category) => {
  const go = vi.fn();
  // SAFETY: The handler reads only navigation.go and the select's current value.
  pickCategory({ navigation: { go } } as never)({ currentTarget: { value } } as never);

  expect(go).toHaveBeenCalledExactlyOnceWith({ category, page: 1 });
});
