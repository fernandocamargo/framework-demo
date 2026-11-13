// What the wizard's render shows at each step, worked out from the flow and the form.
import { money, plural } from '@/format'
import { newPrice, ruleProblem } from './rule'
import { STEP } from './state'

const STEPS = ['Products', 'Rule', 'Preview', 'Apply', 'Summary']

export default ({ state, form, async: { default: categories } }) => {
  const { context } = state
  const { values } = form
  const rule = form.payload()
  const selected = context.items.filter((item) => values.selected.includes(item.id))
  // The flow says which step each of its states belongs to (state.ts).
  const step = Math.max(...(Object.keys(STEP) as (keyof typeof STEP)[]).filter((name) => state[name]).map((name) => STEP[name]))
  const failed = context.results.filter((result) => result.error !== null)
  const total = context.results.length + context.queue.length
  return {
    state,
    set: form.set,
    values,
    step,
    steps: STEPS.map((label, index) => ({ label, current: index + 1 === step, done: index + 1 < step })),
    stepText: `Step ${step} of ${STEPS.length}: ${STEPS[step - 1]}`,
    categories: [{ slug: '', name: 'All categories (first page)' }, ...categories],
    items: context.items.map((item) => ({ id: item.id, title: item.title, price: money(item.price) })),
    selectedIds: values.selected.map(String),
    selectionText: `${values.selected.length} of ${plural(context.items.length, 'product')} selected`,
    loadError: context.error,
    ruleProblem: ruleProblem(rule),
    ruleText: `${rule.direction === 'increase' ? 'Increase' : 'Decrease'} by ${rule.percent}%`,
    preview: selected.map((item) => ({ id: item.id, title: item.title, from: money(item.price), to: money(newPrice(item.price, rule)) })),
    progress: { value: context.results.length, total, text: `${context.results.length} of ${total} saved or failed` },
    current: context.queue[0]?.title ?? null,
    results: context.results.map((result) => ({ ...result, from: money(result.from), to: money(result.to) })),
    summaryText: `${plural(context.results.length - failed.length, 'price')} changed${failed.length ? `, ${failed.length} failed` : ''}.`,
    failedCount: failed.length,
  }
}
