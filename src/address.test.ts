import './address.setup';
import { address, codec, HOME, links, navigation } from './address';

/** The router navigates in a later task. */
const settled = () => new Promise<void>((resolve) => setTimeout(resolve));
beforeEach(async () => {
  address.replace('/products');
  await settled();
});

test('the default page has the shortest address', async () => {
  expect(codec.format('/products', {}, HOME)).toBe('/products');
  expect(address.at('/').pattern).toBe('/products');
});

test('an entity and its action are in the path, and filters have one canonical JSON order', async () => {
  const query = { category: 'lighting', order: 'desc', page: 3, q: 'desk lamp', sort: 'price' };
  const link = codec.format('/products/:id/edit', { id: 12 }, query);
  expect(link.split('?')[0]).toBe('/products/12/edit');
  expect(new URLSearchParams(link.split('?')[1]).get('query')).toBe(
    '{"v":1,"category":"lighting","order":"desc","page":3,"q":"desk lamp","sort":"price"}',
  );
  expect(address.at(link)).toMatchObject({ params: { id: 12 }, pattern: '/products/:id/edit', query });
  expect(codec.format('/products/:id/edit', { id: 12 }, Object.fromEntries(Object.entries(query).reverse()))).toBe(
    link,
  );
});

test('unversioned and version zero JSON still parse; an unknown version falls back', async () => {
  for (const query of [{ page: 2 }, { page: 2, v: 0 }]) {
    const parsed = address.at(`/products?${new URLSearchParams({ query: JSON.stringify(query) })}`);
    expect(parsed.query['page']).toBe(2);
    expect(parsed.href).toBe(codec.format('/products', {}, { page: 2 }));
  }
  expect(address.at('/products?query=%7B%22v%22%3A999%2C%22page%22%3A2%7D').query['page']).toBe(1);
});

test('a link may carry anything: bad fields fall back and unknown fields disappear', async () => {
  expect(address.at('http://[').href).toBe('/products');
  const bad = { category: [], order: 'sideways', page: -2, q: {}, signin: 'yes', sort: 'colour', unknown: true };
  expect(address.at(`/products?${new URLSearchParams({ query: JSON.stringify(bad) })}`).href).toBe('/products');
  for (const text of ['{', 'null', '[]', 'true', '"words"']) {
    expect(address.at(`/products?${new URLSearchParams({ query: text })}`).href).toBe('/products');
  }
});

test('static names win over parameters, invalid parameters go home, and parents remain in the chain', async () => {
  expect(address.at('/products/new').pattern).toBe('/products/new');
  expect(address.at('/products/bulk/confirm').chain.at(-1)?.chart?.state).toBe('confirmingLargeChange');
  for (const path of ['/products/nope', '/products/-2', '/products/4/edit/extra', '/products/%2f', '/products/%zz'])
    expect(address.at(path).pattern).toBe('/products');
  expect(address.at('/products/4/edit').chain.map(({ path }) => path)).toEqual([
    '/products',
    '/products/:id',
    '/products/:id/edit',
  ]);
});

test('a query patch keeps the path and every field it did not name', async () => {
  navigation.go('/products/:id/edit', { id: 4 }, { category: 'audio', q: 'desk', world: 'memory' });
  await settled();
  const params = address.getSnapshot().params;
  navigation.query('/products', { page: 2 });
  await settled();
  expect(address.getSnapshot().params).toBe(params);
  expect(address.getSnapshot()).toMatchObject({
    path: '/products/4/edit',
    query: { category: 'audio', page: 2, q: 'desk', world: 'memory' },
  });
  expect(() => address.navigation.query('/orders', { region: 'TX' })).toThrow('not active');
});

test('list links keep their filters and every shell setting', async () => {
  navigation.query({ lang: 'pt-BR', skin: 'blueprint', world: 'memory' });
  await settled();
  const filters = { ...HOME, category: 'audio', page: 2 };
  const { filtered, href, sectionHref } = links(address.getSnapshot().route as never);
  expect(address.at(href('/products/:id/edit', { id: 5 }, filters))).toMatchObject({
    path: '/products/5/edit',
    query: { ...filters, lang: 'pt-BR', skin: 'blueprint', world: 'memory' },
  });
  expect(address.at(filtered(filters, { category: 'desks' })).query['page']).toBe(1);
  expect(address.at(sectionHref('orders'))).toMatchObject({ path: '/orders', query: { page: 1, world: 'memory' } });
});

test('sign-in can cover any page, and orders retain their own query slice', async () => {
  navigation.go('/orders/:id', { id: 24 }, { region: 'TX' });
  await settled();
  navigation.query({ signin: true });
  await settled();
  expect(address.getSnapshot()).toMatchObject({ path: '/orders/24', query: { region: 'TX', signin: true } });
  expect(address.at('/orders?query=%7B%22region%22%3A%22texas%22%7D').query['region']).toBe('');
});

test('a path change keeps the shell fields and those of the routes both addresses are under, and no other', async () => {
  navigation.go('/products', {}, { page: 3, q: 'lamp', skin: 'blueprint' });
  await settled();
  expect(address.at(navigation.href('/products/:id', { id: 4 })).query).toMatchObject({ page: 3, q: 'lamp' });
  navigation.go('/orders');
  await settled();
  expect(address.getSnapshot()).toMatchObject({ path: '/orders', query: { page: 1, skin: 'blueprint' } });
  expect(address.getSnapshot().href).not.toContain('page');
});
