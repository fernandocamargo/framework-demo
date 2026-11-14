// The bulk price change, as a wizard: choose products, set a rule, preview, apply, summary.
//
// Applying sends one save per product, in order. Each result is kept, so the person watches
// the progress, and a failure does not stop the rest. The summary lists what failed, and the
// failed ones can be sent again.
import type { Listed } from '@/services/products/types'
import { newPrice, ruleProblem } from './rule'

export const description = 'Change the price of several products by one rule.'

export type Result = { id: number; title: string; from: number; to: number; error: string | null }

/** The step of the wizard each state belongs to. */
export const STEP = { loadingProducts: 1, choosing: 1, settingRule: 2, previewing: 3, confirmingLargeChange: 3, applying: 4, advancing: 4, summary: 5 } as const

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
/** A rule that moves prices by more than the `largeChangeAt` flag's percentage is applied only after a second confirmation. */
export const isLargeChange = ({ form, flags }) => form.payload().percent > flags.largeChangeAt
/** The folder's acl.ts decides, as the percentage is typed, whether this change may be applied. */
export const refused = ({ acl }) => !acl.allowed
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

// Declared from the backend's grants: without the grant to update prices, the preview offers no
// `apply` at all. Within it, the limit is the folder's acl.ts's decision, read by a guard when the
// event arrives, since it changes as the percentage is typed.
export default ({ services, acl }) => ({
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
      ...(acl.grants.prices.includes('update') && { apply: [{ guard: refused }, { guard: isLargeChange, target: 'confirmingLargeChange' }, { target: 'applying', actions: queueSelected }] }),
      close: { actions: close },
    },
  },
  confirmingLargeChange: {
    description: 'The rule moves prices by more than the largeChangeAt flag says. The person confirms it a second time, or goes back to the preview.',
    on: { confirm: [{ guard: refused }, { target: 'applying', actions: queueSelected }], back: 'previewing' },
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

// ---- What the states gallery shows each state with --------------------------------------------

const audio = [
  { id: 1, title: 'Studio Monitor', price: 199.99, version: 1 },
  { id: 2, title: 'Desk Microphone', price: 93.99, version: 1 },
  { id: 4, title: 'Audio Interface', price: 167.99, version: 1 },
] as Listed[]
const chosen = { category: 'audio', selected: [1, 2, 4], direction: 'increase', percent: 15 }

/** What a state needs on screen beyond what the chart starts with: the products read, the rule, the results so far. */
export const examples = {
  choosing: { context: { items: audio }, values: chosen },
  settingRule: { context: { items: audio }, values: chosen },
  previewing: { context: { items: audio }, values: chosen },
  confirmingLargeChange: { context: { items: audio }, values: { ...chosen, percent: 60 } },
  applying: {
    context: { items: audio, queue: [audio[2]], results: [{ id: 1, title: 'Studio Monitor', from: 199.99, to: 229.99, error: null }, { id: 2, title: 'Desk Microphone', from: 93.99, to: 108.09, error: null }] },
    values: chosen,
  },
  advancing: { context: { items: audio, queue: [], results: [] }, values: chosen },
  summary: {
    context: {
      items: audio,
      results: [
        { id: 1, title: 'Studio Monitor', from: 199.99, to: 229.99, error: null },
        { id: 2, title: 'Desk Microphone', from: 93.99, to: 108.09, error: 'The server answered 500.' },
        { id: 4, title: 'Audio Interface', from: 167.99, to: 193.19, error: null },
      ],
    },
    values: chosen,
  },
}
