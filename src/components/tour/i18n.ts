// The tour's words, in English. Translations: i18n/<locale>.json.
export default {
  back: 'Back',
  close: 'Close the tour',
  failed: 'Could not sign in: {message}',
  finish: 'Finish',
  keys: { back: 'Previous step', next: 'Next step', start: 'Start the tour' },
  next: 'Next',
  open: 'Take the tour',
  progress: 'Step {index, number} of {count, number}',
  remote:
    "This app's flags are served by GrowthBook, and its dashboard owns this one. The stock count stays as the dashboard has it.",
  steps: {
    address: {
      text: 'The list is now sorted by price, highest first, and the address says so. A link to this list carries the same filters.',
      title: 'The address holds the filters',
    },
    failing: {
      text: 'The catalogue says it could not be read, and offers to try again in its place.',
      title: 'Failures show a message',
    },
    finished: {
      text: 'Finish closes the tour, tidies the lab, and puts back the skin and the language you started with.',
      title: 'That is the tour',
    },
    flag: {
      text: 'The stock count is on for everyone, so each row has a stepper with one less and one more in stock. Try those two buttons.',
      title: 'A flag is served to everyone',
    },
    healed: {
      text: 'The network is healthy again, and the catalogue shows its rows.',
      title: 'The server answers again',
    },
    language: {
      text: 'The page and this tour now speak Brazilian Portuguese. The address keeps the language, so a reload keeps it.',
      title: 'The language changes in place',
    },
    person: {
      text: 'Emily, an admin, is signed in. Her name is in the header, and the rows offer the actions an admin may take.',
      title: 'An admin signs in',
    },
    product: {
      text: 'The address names one product, and its dialog opens over the list. Its reviews are read on their own.',
      title: 'A product opens over the list',
    },
    skin: {
      text: 'The broadsheet skin changes the sheets and nothing in the markup. The headings, the boxes and the lab all wear it.',
      title: 'The same page, another skin',
    },
    slow: {
      text: 'Every request now waits 1.5 seconds. The page keeps the list on screen until the next page arrives.',
      title: 'Slow answers keep the page',
    },
  },
  title: 'Guided tour',
};
