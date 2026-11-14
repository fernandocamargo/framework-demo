// What the editor's render shows in each state of the flow, in the locale on screen. The fields
// start from the seeded values and hold what is typed, so a key renders its field alone; the
// values are read only to say what is wrong with them, once a save was tried.

import { CURRENCY } from '@/format'
import { problems } from './form'

export default ({ state, form, i18n, acl, async: { default: categories } }) => {
  const { context } = state
  const busy = state.saving || state.creating || state.overwriting
  return {
    i18n,
    send: state.send,
    initial: form.initial,
    set: form.set,
    categories,
    currency: { style: 'currency', currency: CURRENCY } as const,
    heading: context.creating ? i18n.heading.create : context.title ? i18n.heading.edit({ title: context.title }) : i18n.heading.untitled,
    saveText: context.creating ? i18n.save.create : i18n.save.edit,
    problems: context.checked ? Object.fromEntries(problems(form.values).map((field) => [field, i18n.problems[field]])) : {},
    loading: state.loading || state.starting,
    unavailable: state.unavailable,
    // The form stays on screen, and locked, while a save runs or a question is open over it.
    formShown: !(state.loading || state.starting || state.unavailable),
    locked: busy || state.conflict || state.confirmingDiscard || !acl.allowed,
    readOnly: !acl.allowed,
    busy,
    conflict: state.conflict,
    failed: state.failed,
    confirmingDiscard: state.confirmingDiscard,
    error: context.error ?? '',
  }
}

/** The address each story Storybook shows of this folder needs (framework/storybook). */
export const examples = {
  'Editing a product': { route: { edit: 22 } },
  'A new product': { route: { create: true } },
}
