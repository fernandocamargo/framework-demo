// The price rule of a bulk change, and what it does to a price. Pure, so the preview, the
// flow and the tests all use the same arithmetic.

export type Rule = { direction: 'decrease' | 'increase'; percent: number }

/** No price goes below one cent. */
export const MINIMUM = 0.01

export const newPrice = (price: number, { direction, percent }: Rule) => {
  const factor = 1 + (direction === 'increase' ? percent : -percent) / 100
  return Math.max(MINIMUM, Math.round(price * factor * 100) / 100)
}

/** What stops a rule from being applied; null when nothing does. */
export const ruleProblem = ({ direction, percent }: Rule) =>
  !(percent > 0) ? 'The change must be more than 0%.' : direction === 'decrease' && percent >= 100 ? 'A decrease must be less than 100%.' : percent > 500 ? 'An increase cannot be more than 500%.' : null
