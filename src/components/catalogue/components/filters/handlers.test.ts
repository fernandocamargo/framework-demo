import { vi } from 'vitest';

import { pickSort } from './handlers';

test.each([
  ['price:desc', 'desc'],
  ['price:asc', 'asc'],
] as const)('a native sort change from %s writes both address fields and returns to page one', (value, order) => {
  const go = vi.fn();
  // SAFETY: The handler reads only navigation.go and the select's current value.
  pickSort({ navigation: { go } } as never)({ currentTarget: { value } } as never);

  expect(go).toHaveBeenCalledWith({ order, page: 1, sort: 'price' });
});
