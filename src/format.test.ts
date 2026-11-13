import { stockLevel } from './format'

test('stock reads as out, low or in stock', () => {
  expect(stockLevel(0)).toBe('out')
  expect(stockLevel(5)).toBe('low')
  expect(stockLevel(6)).toBe('in')
})
