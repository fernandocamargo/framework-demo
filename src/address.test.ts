import { filtered, format, HOME, href, parse, sectionHref } from './address';

test('the home page has the shortest address, and every field at its default', () => {
  expect(format(HOME)).toBe('#/products');
  expect(parse('')).toEqual(HOME);
  expect(parse('#/products')).toEqual(HOME);
});

test('an address reads back as the route it was written from', () => {
  const route = {
    ...HOME,
    category: 'lighting',
    order: 'desc' as const,
    page: 3,
    q: 'desk lamp',
    sort: 'price' as const,
    view: 12,
  };
  expect(format(route)).toBe('#/products?q=desk+lamp&category=lighting&sort=price&order=desc&page=3&view=12');
  expect(parse(format(route))).toEqual(route);
});

test('what the address cannot mean falls back to the default', () => {
  expect(parse('#/products?sort=colour&order=sideways&page=-2&view=abc')).toEqual(HOME);
});

test('a link from a list keeps its filters and opens one dialog', () => {
  const filters = { category: 'audio', order: 'asc' as const, page: 2, q: '', sort: 'title' as const };
  expect(href(filters, { edit: 5 })).toBe('#/products?category=audio&page=2&edit=5');
});

test('another filter starts again at page 1', () => {
  const filters = { category: 'audio', order: 'asc' as const, page: 2, q: '', sort: 'title' as const };
  expect(filtered(filters, { category: 'desks' })).toBe('#/products?category=desks');
});

test('an unknown path falls back to products', () => {
  expect(parse('#/nowhere?q=lamp')).toEqual({ ...HOME, q: 'lamp' });
});

test('a section links to its page with every dialog closed', () => {
  expect(sectionHref('products')).toBe('#/products');
  expect(sectionHref('orders')).toBe('#/orders');
});

test('the orders page reads its state and its order from the address', () => {
  expect(parse('#/orders?region=TX&cart=24')).toEqual({ ...HOME, cart: 24, region: 'TX', section: 'orders' });
  expect(format({ ...HOME, cart: 24, region: 'TX', section: 'orders' })).toBe('#/orders?region=TX&cart=24');
});

test('a region is two capital letters, or the empty string for all of them', () => {
  expect(parse('#/orders?region=tx').region).toBe('');
  expect(parse('#/orders?region=TEXAS').region).toBe('');
  expect(parse('#/orders?region=T').region).toBe('T');
  expect(parse('#/orders?region=').region).toBe('');
});

test('an order that is not a number is no order', () => {
  expect(parse('#/orders?cart=abc').cart).toBeNull();
  expect(parse('#/orders?cart=-3').cart).toBeNull();
});
