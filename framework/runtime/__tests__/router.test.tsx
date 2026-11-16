import { QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createElement, lazy, memo, Suspense } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';

// @ts-expect-error The generator is plain JavaScript, with no declarations.
import { routesModule } from '../../plugin/routes.mjs';
import { Pending } from '../activity';
import { createCodec } from '../address';
import { bound } from '../boundaries';
import { createQueryClient } from '../data';
import type { Navigation } from '../index';
import { navigationFor, useNavigation } from '../routing';

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

test.each(['view', 'read'])('a route waiting for its %s keeps the page around it committed', async (waiting) => {
  let finish!: () => void;

  const ready = new Promise<void>((resolve) => {
    finish = resolve;
  });

  function Reading() {
    useSuspenseQuery({ queryFn: () => ready.then(() => 'ready'), queryKey: ['waiting-route'] });

    return <p>Ready</p>;
  }

  const Detail = lazy(async () => {
    if (waiting === 'view') await ready;

    return { default: waiting === 'read' ? Reading : () => <p>Ready</p> };
  });

  // SAFETY: These are the generator's routes and the component imports its expression names.
  const routes = new Function(
    'createElement',
    'Route',
    'Routes',
    'Suspense',
    'Pending',
    'bound',
    'Route0',
    `return ${routesModule({ routes: codec.definitions }, '/', 'products').element};`,
  )(createElement, Route, Routes, Suspense, Pending, bound, Detail);

  let renders = 0;

  function Page() {
    renders++;

    const location = useLocation();
    const navigate = useNavigate();

    return (
      <>
        <output>{location.pathname}</output>
        <input aria-label="kept draft" defaultValue="typed" />
        <button onClick={() => void navigate('/products/4')}>Wait</button>
        {routes}
      </>
    );
  }

  await act(async () =>
    render(
      <MemoryRouter initialEntries={['/products']}>
        <QueryClientProvider client={createQueryClient()}>
          <Suspense fallback={<Pending />}>
            <Routes>
              <Route element={<Page />} path="products/*" />
            </Routes>
          </Suspense>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  const field = await screen.findByLabelText('kept draft');
  await act(async () => fireEvent.click(screen.getByText('Wait')));
  expect(screen.getByRole('status').textContent).toBe('/products/4');
  expect(screen.getByLabelText('kept draft')).toBe(field);
  await act(async () => finish());
  expect(screen.getByText('Ready')).toBeTruthy();
  expect(renders).toBe(2);
});

test('navigation validates typed parameters and carries shell fields without a store', () => {
  const navigate = vi.fn();
  const navigation = navigationFor(codec, navigate, () => codec.read('/products', '?query={"skin":"blueprint"}'));
  navigation.go('/products/:id', { id: 4 });
  expect(navigate).toHaveBeenCalledWith('/products/4?query=%7B%22v%22%3A1%2C%22skin%22%3A%22blueprint%22%7D');
  expect(() => navigation.go('/products/:id', { id: 0 })).toThrow('Invalid parameter');
});

test('a query patch with the current values adds no history entry', () => {
  const navigate = vi.fn();
  const navigation = navigationFor(codec, navigate, () => codec.read('/products', '', '#kept'));

  navigation.query({ skin: 'default' });
  navigation.query({}, { replace: true });
  expect(navigate).not.toHaveBeenCalled();
  expect(() => navigation.query('/products/:id', {})).toThrow('not active');
  navigation.query({ skin: 'blueprint' });
  expect(navigate).toHaveBeenCalledExactlyOnceWith(
    '/products?query=%7B%22v%22%3A1%2C%22skin%22%3A%22blueprint%22%7D#kept',
    { replace: false },
  );
});

test('navigation keeps its identity and reads the current history, including a hosting base', async () => {
  const based = createCodec(codec.definitions, codec.global, codec.home, '/stockroom/');
  const seen: Navigation[] = [];

  const Commands = memo(function Commands() {
    const navigation = useNavigation(based);
    seen.push(navigation);

    return (
      <>
        <button onClick={() => navigation.go('/products/:id', { id: 4 })}>Detail</button>
        <button onClick={() => navigation.query({ skin: 'blueprint' })}>Skin</button>
        <button onClick={() => navigation.go('/products')}>Products</button>
      </>
    );
  });

  function Address() {
    const { pathname, search } = useLocation();

    return (
      <output>
        {pathname}
        {search}
      </output>
    );
  }

  render(
    <MemoryRouter basename="/stockroom" initialEntries={['/stockroom/products']}>
      <Commands />
      <Address />
    </MemoryRouter>,
  );
  await act(async () => fireEvent.click(screen.getByText('Detail')));
  expect(screen.getByRole('status').textContent).toBe('/products/4');
  await act(async () => fireEvent.click(screen.getByText('Skin')));
  expect(screen.getByRole('status').textContent).toContain('/products/4?query=');
  await act(async () => fireEvent.click(screen.getByText('Products')));
  expect(screen.getByRole('status').textContent).toContain('/products?query=');
  expect(seen).toHaveLength(1);
  expect(seen[0]!.href('/products')).toContain('blueprint');
});
