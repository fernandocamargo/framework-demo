import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';

import { createCodec } from '../address';
import { navigationFor } from '../routing';

const codec = createCodec(
  [
    { folder: 'products', keys: [], owner: 'app', params: {}, path: '/products', query: {} },
    {
      folder: 'detail',
      keys: ['id'],
      owner: 'products',
      params: { id: { min: 1, type: 'integer' } },
      path: '/products/:id',
      query: {},
    },
  ],
  { skin: { default: 'default', type: 'string' } },
  '/products',
);

function Products() {
  const navigate = useNavigate();

  return (
    <section>
      <input aria-label="draft" defaultValue="kept" />
      <button onClick={() => void navigate('/products/4')}>Open</button>
      <button onClick={() => void navigate(-1)}>Back</button>
      <Routes>
        <Route element={<p>Detail</p>} path=":id" />
      </Routes>
    </section>
  );
}

test('each folder places its own Routes, and its native field stays mounted through a child and Back', async () => {
  render(
    <MemoryRouter initialEntries={['/products']}>
      <Routes>
        <Route element={<Products />} path="products/*" />
      </Routes>
    </MemoryRouter>,
  );
  const field = screen.getByLabelText('draft');
  fireEvent.change(field, { target: { value: 'typed' } });
  await act(async () => fireEvent.click(screen.getByText('Open')));
  expect(screen.getByText('Detail')).toBeTruthy();
  expect(screen.getByLabelText('draft')).toBe(field);
  await act(async () => fireEvent.click(screen.getByText('Back')));
  expect(screen.queryByText('Detail')).toBeNull();
  // SAFETY: The draft label belongs to the input rendered above.
  expect((screen.getByLabelText('draft') as HTMLInputElement).value).toBe('typed');
});

test('navigation validates typed parameters and carries shell fields without a store', () => {
  const navigate = vi.fn();
  const navigation = navigationFor(codec, navigate, () => codec.read('/products', '?query={"skin":"blueprint"}'));
  navigation.go('/products/:id', { id: 4 });
  expect(navigate).toHaveBeenCalledWith('/products/4?query=%7B%22v%22%3A1%2C%22skin%22%3A%22blueprint%22%7D');
  expect(() => navigation.go('/products/:id', { id: 0 })).toThrow('Invalid parameter');
});
