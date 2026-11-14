// The wizard's words, in English. Translations: i18n/<locale>.json. Rich text (`<b>`) is
// placed by the render, which says what a tag becomes.
export default {
  title: 'Bulk price change',
  steps: { apply: 'Apply', preview: 'Preview', products: 'Products', rule: 'Rule', summary: 'Summary' },
  step: 'Step {step, number} of {count, number}: {label}',
  close: 'Close',
  choose: {
    all: 'All categories (first page)',
    category: 'Category',
    failed: 'The products could not be read: {message}',
    loading: 'Reading the products',
    next: 'Next: the rule',
    retry: 'Try again',
    selected: '{selected, number} of {count, plural, one {# product} other {# products}} selected',
  },
  rule: {
    by: 'By',
    decrease: 'Decrease',
    direction: 'Direction',
    increase: 'Increase',
    next: 'Next: preview',
    text: '{direction, select, increase {Increase} other {Decrease}} by {percent, number}%',
  },
  limits: {
    none: 'You are not granted price changes.',
    over: 'You change prices by {limit, number}% at most. Someone with a larger limit can apply this one.',
  },
  problems: {
    decreaseTooLarge: 'A decrease must be less than 100%.',
    increaseTooLarge: 'An increase cannot be more than 500%.',
    none: 'The change must be more than 0%.',
  },
  preview: {
    after: 'After',
    applies: '<b>{rule}</b>, for {selected, number} of {count, plural, one {# product} other {# products}}.',
    apply: 'Apply to {count, number}',
    now: 'Now',
    product: 'Product',
  },
  large: {
    back: 'Back to the preview',
    confirm: 'Yes, apply it',
    text: '<b>{rule}</b> is a large change. It will be applied to {count, plural, one {# product} other {# products}}.',
    title: 'Change these prices by more than {limit, number}%?',
  },
  progress: {
    done: '{done, number} of {total, number} saved or failed',
    label: 'Prices saved',
    saving: 'Saving {title}…',
  },
  results: 'Results',
  summary: '{changed, plural, one {# price} other {# prices}} changed{failed, plural, =0 {} other {, # failed}}.',
  retryFailed: 'Try the {count, number} failed again',
  back: 'Back',
  cancel: 'Cancel',
  done: 'Done',
  keys: { apply: 'Apply the change', next: 'Next step' },
};
