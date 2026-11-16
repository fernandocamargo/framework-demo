// The bulk price change, as a wizard: choose products, set a rule, preview, apply, summary.
//
// Applying sends one save per product, in order. Each result is kept, so the person watches
// the progress, and a failure does not stop the rest. The summary lists what failed, and the
// failed ones can be sent again.

import type { Listed } from '@/services/products/types';

import { newPrice, ruleProblem } from './rule';

export const description = 'Change the price of several products by one rule.';

export type Result = { error: null | string; from: number; id: number; title: string; to: number };

/** The step of the wizard each state belongs to. */
export const STEP = {
  advancing: 4,
  applying: 4,
  choosing: 1,
  confirmingLargeChange: 3,
  loadingProducts: 1,
  previewing: 3,
  settingRule: 2,
  summary: 5,
} as const;

/** What the events carry beside their type. */
export type Events = { address: { route: null | string }; categoryChanged: { category: string } };

export const context = () => ({
  error: null as null | string,
  /** The products of the chosen category, as they were read. */
  items: [] as Listed[],
  /** The products still to save, first one next. */
  queue: [] as Listed[],
  results: [] as Result[],
});

// ---- Checks ----------------------------------------------------------------------------------

export const nothingSelected = ({ form }) => form.values.selected.length === 0;
export const invalidRule = ({ form }) => ruleProblem(form.payload()) !== null;
/** A rule that moves prices by more than the `largeChangeAt` flag's percentage is applied only after a second confirmation. */
export const isLargeChange = ({ flags, form }) => form.payload().percent > flags.largeChangeAt;
/** The folder's acl.ts decides, as the percentage is typed, whether this change may be applied. */
export const refused = ({ acl }) => !acl.allowed;
/** Forward may reopen a confirmation only while this form still describes a valid change. */
export const askedForConfirmation = ({ acl, event, form }) =>
  event.route === 'confirm' && acl.allowed && form.values.selected.length > 0 && ruleProblem(form.payload()) === null;
export const leavingConfirmation = ({ event }) => event.route === null;
export const leavingEmptyConfirmation = ({ event, form }) => event.route === null && form.values.selected.length === 0;
export const queueLeft = ({ context }) => context.queue.length > 0;
export const hasFailures = ({ context }) => context.results.some((result) => result.error !== null);

// ---- Changes ---------------------------------------------------------------------------------

/** A new list of products: all of them start selected. */
export const rememberItems = ({ event, form }) => {
  const items = event.output.items as Listed[];
  form.set(
    'selected',
    items.map((item) => item.id),
  );
  return { error: null, items };
};
export const chooseCategory = ({ event, form }) => form.set('category', event.category ?? form.values.category);
export const rememberError = ({ event }) => ({
  error: event.error instanceof Error ? event.error.message : String(event.error),
  items: [],
});
export const queueSelected = ({ context, form }) => {
  const chosen = new Set<number>(form.values.selected);
  return { queue: context.items.filter((item) => chosen.has(item.id)), results: [] };
};
/** The failed ones go again; the ones that were saved stay in the results. */
export const queueFailed = ({ context }) => {
  const failed = new Set(context.results.filter((result) => result.error !== null).map((result) => result.id));
  return {
    queue: context.items.filter((item) => failed.has(item.id)),
    results: context.results.filter((result) => result.error === null),
  };
};
const result = (context: { queue: Listed[] }, rule: Parameters<typeof newPrice>[1], error: null | string): Result => {
  const item = context.queue[0]!;
  return { error, from: item.price, id: item.id, title: item.title, to: newPrice(item.price, rule) };
};
export const recordSaved = ({ context, form }) => ({
  queue: context.queue.slice(1),
  results: [...context.results, result(context, form.payload(), null)],
});
export const recordFailed = ({ context, event, form }) => ({
  queue: context.queue.slice(1),
  results: [
    ...context.results,
    result(context, form.payload(), event.error instanceof Error ? event.error.message : String(event.error)),
  ],
});
export const close = ({ navigation }) => navigation.go('/products');

// ---- What the services are given ---------------------------------------------------------------

/** The category the event names; the form's, when the list is read for the first time or again. */
export const productsToList = ({ event, form }) => ({
  category: event.category ?? form.values.category,
  order: 'asc' as const,
  page: 1,
  q: '',
  sort: 'title' as const,
});
export const nextChange = ({ context, form }) => {
  const item = context.queue[0]!;
  return { changes: { price: newPrice(item.price, form.payload()) }, id: item.id, version: item.version };
};

// Declared from the backend's grants: without the grant to update prices, the preview offers no
// `apply` at all. Within it, the limit is the folder's acl.ts's decision, read by a guard when the
// event arrives, since it changes as the percentage is typed.
export default ({ acl, services }) => ({
  loadingProducts: {
    description: 'Reading the products of the chosen category.',
    invoke: {
      input: productsToList,
      onDone: { actions: rememberItems, target: 'choosing' },
      onError: { actions: rememberError, target: 'choosing' },
      src: services.products.search,
    },
    on: { close: { actions: close } },
  },
  choosing: {
    description: 'Step 1: which products.',
    on: {
      categoryChanged: { actions: chooseCategory, target: 'loadingProducts' },
      close: { actions: close },
      next: [{ guard: nothingSelected }, { target: 'settingRule' }],
      retry: 'loadingProducts',
    },
  },
  settingRule: {
    description: 'Step 2: the rule.',
    on: {
      back: 'choosing',
      close: { actions: close },
      next: [{ guard: invalidRule }, { target: 'previewing' }],
    },
  },
  previewing: {
    description: 'Step 3: each old price beside its new one.',
    on: {
      address: { guard: askedForConfirmation, target: 'confirmingLargeChange' },
      back: 'settingRule',
      ...(acl.grants.prices.includes('update') && {
        apply: [
          { guard: refused },
          { guard: isLargeChange, target: 'confirmingLargeChange' },
          { actions: queueSelected, target: 'applying' },
        ],
      }),
      close: { actions: close },
    },
  },
  confirmingLargeChange: {
    description:
      'The rule moves prices by more than the largeChangeAt flag says. The person confirms it a second time, or goes back to the preview.',
    meta: { route: 'confirm' },
    on: {
      address: [
        { guard: leavingEmptyConfirmation, target: 'loadingProducts' },
        { guard: leavingConfirmation, target: 'previewing' },
      ],
      back: [{ guard: nothingSelected, target: 'loadingProducts' }, { target: 'previewing' }],
      confirm: [
        { guard: nothingSelected },
        { guard: invalidRule },
        { guard: refused },
        { actions: queueSelected, target: 'applying' },
      ],
    },
  },
  applying: {
    description: 'Step 4: one save per product, in order. A failure is kept and the rest go on.',
    invoke: {
      input: nextChange,
      onDone: { actions: recordSaved, target: 'advancing' },
      onError: { actions: recordFailed, target: 'advancing' },
      src: services.products.save,
    },
  },
  advancing: {
    always: [{ guard: queueLeft, target: 'applying' }, { target: 'summary' }],
  },
  summary: {
    description: 'Step 5: what was saved, and what failed.',
    on: {
      close: { actions: close },
      retryFailed: { actions: queueFailed, guard: hasFailures, target: 'applying' },
    },
  },
});

// ---- What the states gallery shows each state with --------------------------------------------

const audio = [
  { id: 1, price: 199.99, title: 'Studio Monitor', version: 1 },
  { id: 2, price: 93.99, title: 'Desk Microphone', version: 1 },
  { id: 4, price: 167.99, title: 'Audio Interface', version: 1 },
] as Listed[];
const chosen = { category: 'audio', direction: 'increase', percent: 15, selected: [1, 2, 4] };

/** What a state needs on screen beyond what the chart starts with: the products read, the rule, the results so far. */
export const examples = {
  advancing: { context: { items: audio, queue: [], results: [] }, values: chosen },
  applying: {
    context: {
      items: audio,
      queue: [audio[2]],
      results: [
        { error: null, from: 199.99, id: 1, title: 'Studio Monitor', to: 229.99 },
        { error: null, from: 93.99, id: 2, title: 'Desk Microphone', to: 108.09 },
      ],
    },
    values: chosen,
  },
  choosing: { context: { items: audio }, values: chosen },
  confirmingLargeChange: { context: { items: audio }, values: { ...chosen, percent: 60 } },
  previewing: { context: { items: audio }, values: chosen },
  settingRule: { context: { items: audio }, values: chosen },
  summary: {
    context: {
      items: audio,
      results: [
        { error: null, from: 199.99, id: 1, title: 'Studio Monitor', to: 229.99 },
        { error: 'The server answered 500.', from: 93.99, id: 2, title: 'Desk Microphone', to: 108.09 },
        { error: null, from: 167.99, id: 4, title: 'Audio Interface', to: 193.19 },
      ],
    },
    values: chosen,
  },
};
