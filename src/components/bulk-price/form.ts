// The wizard's fields: which products, and the rule.

import type { Rule } from './rule'

export const seed = (_: undefined) => ({
  category: '',
  selected: [] as number[],
  direction: 'decrease' as Rule['direction'],
  percent: 10,
})

export type Values = ReturnType<typeof seed>

export const payload = (values: Values): Rule => ({ direction: values.direction, percent: values.percent })
