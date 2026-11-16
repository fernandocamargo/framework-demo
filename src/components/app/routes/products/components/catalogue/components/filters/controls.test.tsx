import { act, fireEvent, render } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';

// Load the real event destination first to break its circular framework import in this fixture.
import '@/clients/tracker';
import { createQueryClient, Root, whenIdle } from 'framework';
import { messagesOf } from 'framework/testing';

import Filters from '.';
import * as messages from './i18n';
import portuguese from './i18n/pt-BR.json';
import type { Props } from './props';
import filtersProps from './props';
import * as filterRender from './render';

const categories = [
  { name: 'Audio', slug: 'audio' },
  { name: 'Lighting', slug: 'lighting' },
];

function Address() {
  return <output aria-label="Address">{useLocation().search}</output>;
}

const initial: Props = { categories, category: '', order: 'asc', q: '', sort: 'title' };

test.each([
  ['English', messagesOf(messages), 'All categories', 'Price, high to low'],
  [
    'Português',
    messagesOf(messages, 'pt-BR', portuguese, 'components/app/routes/products/components/catalogue/components/filters'),
    'Todas as categorias',
    'Preço, do maior para o menor',
  ],
])('native choices use the address and the labels in %s', (_, i18n, all, label) => {
  // SAFETY: These are every filter field and form value this shaper reads.
  const filters = filtersProps({
    ...initial,
    form: { values: { q: '' } },
    i18n,
    order: 'desc',
    sort: 'price',
  } as never);

  expect(filters.category).toBe('all');
  expect(filters.categories[0]?.name).toBe(all);
  expect(filters.sort).toBe('price:desc');
  expect(filters.sorts).toHaveLength(5);
  expect(filters.sorts.find((item) => item.id === filters.sort)?.label).toBe(label);
});

test('the real filter folder keeps its nodes and choices while typing, clearing and following the address', async () => {
  const client = createQueryClient();
  const calls = vi.spyOn(filterRender, 'default');

  const page = (props: Props) => (
    <MemoryRouter initialEntries={['/products']}>
      <Root client={client} entity={{ id: 'memory' }}>
        {createElement(Filters, props)}
        <Address />
      </Root>
    </MemoryRouter>
  );

  let shown!: ReturnType<typeof render>;
  await act(async () => {
    shown = render(page(initial));
  });
  await shown.findByRole('searchbox');
  await act(whenIdle);
  const input = shown.getByRole('searchbox', { name: 'Search products' });
  const category = shown.getByRole('combobox', { name: 'Category' });
  const sort = shown.getByRole('combobox', { name: 'Sort' });

  if (
    !(input instanceof HTMLInputElement) ||
    !(category instanceof HTMLSelectElement) ||
    !(sort instanceof HTMLSelectElement)
  )
    throw new Error('The search and both choices must be native controls.');

  const address = () =>
    JSON.parse(new URLSearchParams(shown.getByLabelText('Address').textContent ?? '').get('query') ?? '{}');
  const form = input.form!;
  input.focus();

  const beforeTyping = calls.mock.calls.length;

  for (const value of ['l', 'la', 'lam', 'lamp']) {
    await act(async () => fireEvent.change(input, { target: { value } }));
  }

  expect(calls.mock.calls.length - beforeTyping).toBe(4);
  expect(address()).not.toHaveProperty('q');
  expect(document.activeElement).toBe(input);
  expect(shown.getByRole('combobox', { name: 'Category' })).toBe(category);
  expect(shown.getByRole('combobox', { name: 'Sort' })).toBe(sort);
  expect(category.value).toBe('all');
  expect(sort.value).toBe('title:asc');

  await act(async () => fireEvent.submit(form));
  expect(address()).toMatchObject({ q: 'lamp' });
  await act(async () => shown.rerender(page({ ...initial, q: 'lamp' })));
  await act(whenIdle);
  expect(shown.getByRole('searchbox')).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(shown.container.querySelector('meta[itemprop="query"]')?.getAttribute('content')).toBe('lamp');

  const beforeChoice = calls.mock.calls.length;

  await act(async () => fireEvent.focus(sort));
  await act(async () => fireEvent.change(sort, { target: { value: 'price:desc' } }));
  expect(calls.mock.calls.length).toBe(beforeChoice);
  expect(address()).toMatchObject({ order: 'desc', sort: 'price' });
  await act(async () => shown.rerender(page({ ...initial, order: 'desc', q: 'lamp', sort: 'price' })));
  await act(whenIdle);
  expect(sort.selectedOptions[0]?.textContent).toBe('Price, high to low');

  // Back and forward seed the same field from the address, with the same native selected properties.
  for (const q of ['', 'lamp']) {
    const beforeSeed = calls.mock.calls.length;

    await act(async () => shown.rerender(page({ ...initial, q })));
    await act(whenIdle);
    expect(calls.mock.calls.length - beforeSeed).toBe(2);
    expect(input.value).toBe(q);
    expect(shown.getByRole('searchbox')).toBe(input);
    expect(sort.value).toBe('title:asc');
    expect(document.activeElement).toBe(input);
  }

  await act(async () => fireEvent.reset(form));
  expect(input.value).toBe('');
  expect(address()).not.toHaveProperty('q');
  expect(document.activeElement).toBe(input);

  // Clearing a draft still works when the address already holds an empty search.
  await act(async () => shown.rerender(page(initial)));
  await act(whenIdle);
  await act(async () => fireEvent.change(input, { target: { value: 'draft' } }));
  await act(async () => fireEvent.keyDown(input, { key: 'Escape' }));
  expect(input.value).toBe('');
  expect(address()).not.toHaveProperty('q');
  await act(async () => fireEvent.keyDown(input, { key: 'Escape' }));
  expect(address()).not.toHaveProperty('q');

  await act(async () => fireEvent.change(input, { target: { value: '  desk  ' } }));
  await act(async () => fireEvent.submit(form));
  expect(address()).toMatchObject({ q: 'desk' });
  shown.unmount();
  calls.mockRestore();
});
