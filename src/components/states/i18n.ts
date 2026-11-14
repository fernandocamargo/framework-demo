// The states gallery's words, in English. Translations: i18n/<locale>.json. The states'
// descriptions are each chart's own, as its state.ts writes them.
export default {
  title: 'States',
  intro:
    'Every component with a chart, in each state of the chart, on the memory world. Each frame holds the component in one state: its chart is not started, so nothing moves. What a state needs beyond what the chart starts with comes from the examples its state.ts exports.',
  back: 'Back to the catalogue',
  count: '{count, plural, one {# state} other {# states}}',
  frame: '{path} in the state {state}',
  example: 'with an example',
}
