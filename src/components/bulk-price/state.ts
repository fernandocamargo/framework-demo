// The bulk price change, as a wizard: choose products, set a rule, preview, apply, summary.
//
// Applying sends one save per product, in order. Each result is kept, so the person watches
// the progress, and a failure does not stop the rest. The summary lists what failed, and the
// failed ones can be sent again.
import type { Listed } from '@/services/products/types'
import { newPrice, ruleProblem } from './rule'

export const description = 'Change the price of several products by one rule.'

export type Result = { id: number; title: string; from: number; to: number; error: string | null }

/** What the events carry beside their type. */
export type Events = { categoryChanged: { category: string } }

export const context = () => ({
  /** The products of the chosen category, as they were read. */
  items: [] as Listed[],
  /** The products still to save, first one next. */
  queue: [] as Listed[],
  results: [] as Result[],
  error: null as string | null,
})

// ---- Checks ----------------------------------------------------------------------------------

export const nothingSelected = ({ form }) => form.values.selected.length === 0
export const invalidRule = ({ form }) => ruleProblem(form.payload()) !== null
export const queueLeft = ({ context }) => context.queue.length > 0
export const hasFailures = ({ context }) => context.results.some((result) => result.error !== null)

// ---- Changes ---------------------------------------------------------------------------------

/** A new list of products: all of them start selected. */
export const rememberItems = ({ form, event }) => {
  const items = event.output.items as Listed[]
  form.set(
    'selected',
    items.map((item) => item.id),
  )
  return { items, error: null }
}
export const chooseCategory = ({ form, event }) => form.set('category', event.category ?? form.values.category)
export const rememberError = ({ event }) => ({ items: [], error: event.error instanceof Error ? event.error.message : String(event.error) })
export const queueSelected = ({ context, form }) => ({ queue: context.items.filter((item) => form.values.selected.includes(item.id)), results: [] })
/** The failed ones go again; the ones that were saved stay in the results. */
export const queueFailed = ({ context }) => {
  const failed = new Set(context.results.filter((result) => result.error !== null).map((result) => result.id))
  return { queue: context.items.filter((item) => failed.has(item.id)), results: context.results.filter((result) => result.error === null) }
}
const result = (context: { queue: Listed[] }, rule: Parameters<typeof newPrice>[1], error: string | null): Result => {
  const item = context.queue[0]!
  return { id: item.id, title: item.title, from: item.price, to: newPrice(item.price, rule), error }
}
export const recordSaved = ({ context, form }) => ({ queue: context.queue.slice(1), results: [...context.results, result(context, form.payload(), null)] })
export const recordFailed = ({ context, form, event }) => ({
  queue: context.queue.slice(1),
  results: [...context.results, result(context, form.payload(), event.error instanceof Error ? event.error.message : String(event.error))],
})
export const close = ({ navigation }) => navigation.go({ bulk: false })

// ---- What the services are given ---------------------------------------------------------------

/** The category the event names; the form's, when the list is read for the first time or again. */
export const productsToList = ({ form, event }) => ({ q: '', category: event.category ?? form.values.category, sort: 'title' as const, order: 'asc' as const, page: 1 })
export const nextChange = ({ context, form }) => {
  const item = context.queue[0]!
  return { id: item.id, changes: { price: newPrice(item.price, form.payload()) }, version: item.version }
}

export default ({ services }) => ({
  loadingProducts: {
    description: 'Reading the products of the chosen category.',
    invoke: {
      src: services.products.search,
      input: productsToList,
      onDone: { target: 'choosing', actions: rememberItems },
      onError: { target: 'choosing', actions: rememberError },
    },
    on: { close: { actions: close } },
  },
  choosing: {
    description: 'Step 1: which products.',
    on: {
      categoryChanged: { target: 'loadingProducts', actions: chooseCategory },
      retry: 'loadingProducts',
      next: [{ guard: nothingSelected }, { target: 'settingRule' }],
      close: { actions: close },
    },
  },
  settingRule: {
    description: 'Step 2: the rule.',
    on: {
      back: 'choosing',
      next: [{ guard: invalidRule }, { target: 'previewing' }],
      close: { actions: close },
    },
  },
  previewing: {
    description: 'Step 3: each old price beside its new one.',
    on: {
      back: 'settingRule',
      apply: { target: 'applying', actions: queueSelected },
      close: { actions: close },
    },
  },
  applying: {
    description: 'Step 4: one save per product, in order. A failure is kept and the rest go on.',
    invoke: {
      src: services.products.save,
      input: nextChange,
      onDone: { target: 'advancing', actions: recordSaved },
      onError: { target: 'advancing', actions: recordFailed },
    },
  },
  advancing: {
    always: [{ guard: queueLeft, target: 'applying' }, { target: 'summary' }],
  },
  summary: {
    description: 'Step 5: what was saved, and what failed.',
    on: {
      retryFailed: { guard: hasFailures, target: 'applying', actions: queueFailed },
      close: { actions: close },
    },
  },
})
