import { fromLegacy } from './legacy';

const at = (address: string) => {
  const url = new URL(address, 'http://localhost');
  return fromLegacy({ hash: url.hash, pathname: url.pathname, search: url.search });
};
const query = (address: null | string) =>
  JSON.parse(new URL(address ?? '', 'http://localhost').searchParams.get('query') ?? '{}') as Record<string, unknown>;

test('a dialog in the old hash is a path now, with its filters and the settings of the old search', () => {
  const moved = at('/?world=memory&skin=blueprint#/products?q=lamp&page=3&edit=4');
  expect(moved?.split('?')[0]).toBe('/products/4/edit');
  expect(query(moved)).toEqual({ page: 3, q: 'lamp', skin: 'blueprint', v: 1, world: 'memory' });
  expect(at('/#/products?view=22')).toBe('/products/22');
  expect(at('/#/products?remove=4')).toBe('/products/4/remove');
  expect(at('/#/products?create=1')).toBe('/products/new');
  expect(at('/#/products?bulk=1')).toBe('/products/bulk');
  expect(at('/#/report')).toBe('/report');
});

test('an order, its region and the language come along; sign-in too', () => {
  const moved = at('/?world=memory&lang=pt-BR#/orders?region=TX&cart=12&signin=1');
  expect(moved?.split('?')[0]).toBe('/orders/12');
  expect(query(moved)).toEqual({ lang: 'pt-BR', region: 'TX', signin: true, v: 1, world: 'memory' });
});

test('the gallery keeps its hash; a bad id opens the page under it; a new address is left alone', () => {
  expect(at('/?world=memory#/states/components%2Fproduct%2Feditor/conflict')).toBe(
    `/products?${new URLSearchParams({ query: '{"v":1,"world":"memory"}' })}#/states/components%2Fproduct%2Feditor/conflict`,
  );
  expect(at('/#/products?edit=nope&q=lamp')).toBe(`/products?${new URLSearchParams({ query: '{"v":1,"q":"lamp"}' })}`);
  expect(at('/products/4/edit')).toBeNull();
  expect(at('/products?query=%7B%22v%22%3A1%7D#/products?edit=4')).toBeNull();
  expect(at('/')).toBeNull();
});
