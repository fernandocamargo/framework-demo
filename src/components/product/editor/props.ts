// What the editor's render shows in each state of the flow, in the locale on screen.
import { CURRENCY } from '@/format'
import { problems } from './form'

export default ({ state, form, i18n, async: { default: categories } }) => {
  const { context } = state
  const busy = state.saving || state.creating || state.overwriting
  return {
    i18n,
    send: state.send,
    values: form.values,
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
    locked: busy || state.conflict || state.confirmingDiscard,
    busy,
    conflict: state.conflict,
    failed: state.failed,
    confirmingDiscard: state.confirmingDiscard,
    error: context.error ?? '',
  }
}
