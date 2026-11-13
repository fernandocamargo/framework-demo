// What the wizard's render shows at each step, worked out from the flow and the form, in the
// locale on screen. Prices are formatted by `intl`; the sentences with a bold part are functions
// the render gives the tag to.
import type { ReactNode } from 'react'
import { CURRENCY } from '@/format'
import { newPrice, ruleProblem } from './rule'
import { STEP } from './state'

const STEPS = ['products', 'rule', 'preview', 'apply', 'summary'] as const

export default ({ state, form, i18n, intl, async: { default: categories } }) => {
  const { context } = state
  const { values } = form
  const rule = form.payload()
  const money = (amount: number) => intl.formatNumber(amount, { style: 'currency', currency: CURRENCY })
  const selected = context.items.filter((item) => values.selected.includes(item.id))
  // The flow says which step each of its states belongs to (state.ts).
  const step = Math.max(...(Object.keys(STEP) as (keyof typeof STEP)[]).filter((name) => state[name]).map((name) => STEP[name]))
  const failed = context.results.filter((result) => result.error !== null)
  const total = context.results.length + context.queue.length
  const ruleText = i18n.rule.text({ direction: rule.direction, percent: rule.percent })
  const problem = ruleProblem(rule)
  return {
    i18n,
    state,
    set: form.set,
    values,
    step,
    steps: STEPS.map((name, index) => ({ label: i18n.steps[name], current: index + 1 === step, done: index + 1 < step })),
    stepText: i18n.step({ step, count: STEPS.length, label: i18n.steps[STEPS[step - 1] ?? 'products'] }),
    categories: [{ slug: '', name: i18n.choose.all }, ...categories],
    items: context.items.map((item) => ({ id: item.id, title: item.title, price: money(item.price) })),
    selectedIds: values.selected.map(String),
    selectionText: i18n.choose.selected({ selected: values.selected.length, count: context.items.length }),
    loadError: context.error,
    ruleProblem: problem ? i18n.problems[problem] : null,
    /** The rule, with what makes it bold: `applies(b)`, in the preview and the question. */
    applies: (b: (chunks: ReactNode[]) => ReactNode) => i18n.preview.applies({ rule: ruleText, selected: selected.length, count: context.items.length, b }),
    largeText: (b: (chunks: ReactNode[]) => ReactNode) => i18n.large.text({ rule: ruleText, count: selected.length, b }),
    preview: selected.map((item) => ({ id: item.id, title: item.title, from: money(item.price), to: money(newPrice(item.price, rule)) })),
    applyText: i18n.preview.apply({ count: selected.length }),
    progress: { value: context.results.length, total, text: i18n.progress.done({ done: context.results.length, total }) },
    current: context.queue[0] ? i18n.progress.saving({ title: context.queue[0].title }) : null,
    results: context.results.map((result) => ({ ...result, from: money(result.from), to: money(result.to) })),
    summaryText: i18n.summary({ changed: context.results.length - failed.length, failed: failed.length }),
    retryText: i18n.retryFailed({ count: failed.length }),
    failedCount: failed.length,
  }
}
