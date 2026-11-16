import { messagesOf } from 'framework/testing';

import * as messages from './i18n';
import portuguese from './i18n/pt-BR.json';
import filtersProps from './props';

test.each([
  ['English', messagesOf(messages), 'Price, high to low'],
  [
    'Português',
    messagesOf(messages, 'pt-BR', portuguese, 'components/catalogue/components/filters'),
    'Preço, do maior para o menor',
  ],
])('sort values and labels follow the address in %s', (_, i18n, label) => {
  // SAFETY: These are the filter fields and form values that this props function reads.
  const filters = filtersProps({
    categories: [],
    category: '',
    form: { values: { q: '' } },
    i18n,
    order: 'desc',
    q: '',
    sort: 'price',
  } as never);

  expect(filters.sort).toBe('price:desc');
  expect(filters.sorts).toHaveLength(5);
  expect(filters.sorts.find((item) => item.id === filters.sort)?.label).toBe(label);
});
