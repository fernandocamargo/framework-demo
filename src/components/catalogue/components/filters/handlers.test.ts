import { vi } from 'vitest';

import { pickSort } from './handlers';

test('a native sort change writes both address fields and returns to page one', () => {
  const go = vi.fn();
  // SAFETY: The handler reads only navigation.go and the select's current value.
  pickSort({ navigation: { go } } as never)({ currentTarget: { value: 'price:desc' } } as never);

  expect(go).toHaveBeenCalledWith({ order: 'desc', page: 1, sort: 'price' });
});
