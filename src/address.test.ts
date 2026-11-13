import { filtered, format, HOME, href, parse } from './address'

test('the home page has the shortest address, and every field at its default', () => {
  expect(format(HOME)).toBe('#/products')
  expect(parse('')).toEqual(HOME)
  expect(parse('#/products')).toEqual(HOME)
})

test('an address reads back as the route it was written from', () => {
  const route = { ...HOME, q: 'desk lamp', category: 'lighting', sort: 'price' as const, order: 'desc' as const, page: 3, view: 12 }
  expect(format(route)).toBe('#/products?q=desk+lamp&category=lighting&sort=price&order=desc&page=3&view=12')
  expect(parse(format(route))).toEqual(route)
})

test('what the address cannot mean falls back to the default', () => {
  expect(parse('#/products?sort=colour&order=sideways&page=-2&view=abc')).toEqual(HOME)
})

test('a link from a list keeps its filters and opens one dialog', () => {
  const filters = { q: '', category: 'audio', sort: 'title' as const, order: 'asc' as const, page: 2 }
  expect(href(filters, { edit: 5 })).toBe('#/products?category=audio&page=2&edit=5')
})

test('another filter starts again at page 1', () => {
  const filters = { q: '', category: 'audio', sort: 'title' as const, order: 'asc' as const, page: 2 }
  expect(filtered(filters, { category: 'desks' })).toBe('#/products?category=desks')
})
