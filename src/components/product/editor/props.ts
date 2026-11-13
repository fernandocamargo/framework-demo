// What the editor's render shows in each state of the flow.
import { problems } from './form'

export default ({ state, form, async: { default: categories } }) => {
  const { context } = state
  const busy = state.saving || state.creating || state.overwriting
  return {
    send: state.send,
    values: form.values,
    set: form.set,
    categories,
    heading: context.creating ? 'New product' : context.title ? `Edit ${context.title}` : 'Edit product',
    saveText: context.creating ? 'Create product' : 'Save changes',
    problems: context.checked ? problems(form.values) : {},
    loading: state.loading || state.starting,
    unavailable: state.unavailable,
    // The form stays on screen, and locked, while a save runs or a question is open over it.
    formShown: !(state.loading || state.starting || state.unavailable),
    locked: busy || state.conflict || state.confirmingDiscard,
    busy,
    conflict: state.conflict,
    failed: state.failed,
    confirmingDiscard: state.confirmingDiscard,
    error: context.error,
  }
}
