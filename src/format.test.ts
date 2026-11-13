import { money, plural, stockLevel } from './format'

test('stock reads as out, low or in stock', () => {
  expect(stockLevel(0)).toEqual({ tone: 'danger', label: 'Out of stock' })
  expect(stockLevel(5)).toEqual({ tone: 'warn', label: 'Low: 5 left' })
  expect(stockLevel(6)).toEqual({ tone: 'ok', label: '6 in stock' })
})

test('money and counts', () => {
  expect(money(1234.5)).toBe('$1,234.50')
  expect(plural(1, 'product')).toBe('1 product')
  expect(plural(0, 'product')).toBe('0 products')
})
