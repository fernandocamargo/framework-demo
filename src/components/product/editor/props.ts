// What the editor's render shows in each state of the flow, in the locale on screen. The fields
// start from the seeded values and hold what is typed, so a key renders its field alone; the
// values are read only to say what is wrong with them, once a save was tried.

import { CURRENCY } from '@/format';

import { problems } from './form';

export default ({ acl, async: { default: categories }, form, i18n, state }) => {
  const { context } = state;
  const busy = state.saving || state.creating || state.overwriting;
  return {
    busy,
    categories,
    confirmingDiscard: state.confirmingDiscard,
    conflict: state.conflict,
    currency: { currency: CURRENCY, style: 'currency' } as const,
    error: context.error ?? '',
    failed: state.failed,
    // The form stays on screen, and locked, while a save runs or a question is open over it.
    formShown: !(state.loading || state.starting || state.unavailable),
    heading: context.creating
      ? i18n.heading.create
      : context.title
        ? i18n.heading.edit({ title: context.title })
        : i18n.heading.untitled,
    i18n,
    initial: form.initial,
    loading: state.loading || state.starting,
    locked: busy || state.conflict || state.confirmingDiscard || !acl.allowed,
    problems: context.checked
      ? Object.fromEntries(problems(form.values).map((field) => [field, i18n.problems[field]]))
      : {},
    readOnly: !acl.allowed,
    saveText: context.creating ? i18n.save.create : i18n.save.edit,
    send: state.send,
    set: form.set,
    unavailable: state.unavailable,
  };
};

/** The address each story Storybook shows of this folder needs (framework/storybook). */
export const examples = {
  'A new product': { route: { create: true } },
  'Editing a product': { route: { edit: 22 } },
};
