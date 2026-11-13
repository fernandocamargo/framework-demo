// What the wizard's render shows at each step, worked out from the flow and the form.
import { money, plural } from '@/format'
import { newPrice, ruleProblem } from './rule'

const STEPS = ['Products', 'Rule', 'Preview', 'Apply', 'Summary']

export default ({ state, form, async: { default: categories } }) => {
  const { context } = state
  const { values } = form
  const rule = form.payload()
  const selected = context.items.filter((item) => values.selected.includes(item.id))
  const step = state.loadingProducts || state.choosing ? 0 : state.settingRule ? 1 : state.previewing ? 2 : state.applying || state.advancing ? 3 : 4
  const failed = context.results.filter((result) => result.error !== null)
  const total = context.results.length + context.queue.length
  return {
    state,
    set: form.set,
    values,
    steps: STEPS.map((label, index) => ({ label, current: index === step, done: index < step })),
    stepText: `Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`,
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
