// The search belongs below the dialog shell. Typing again drops an older answer.

import type { Listed, Query } from '@/services/products/types';

export const description = 'The palette search: waiting for text, pausing, or searching products.';

export const context = () => ({ results: Array<Listed>(), text: '' });

export type Events = { typed: { text: string } };

export const rememberText = ({ event }) => ({ text: event.text });
export const rememberResults = ({ event }) => ({ results: event.output.items.slice(0, 6) });
export const forgetResults = () => ({ results: Array<Listed>() });

export const enoughText = ({ context }) => context.text.trim().length >= 2;

export const query = ({ context }): Query => ({
  category: '',
  order: 'asc',
  page: 1,
  q: context.text.trim(),
  sort: 'title',
});

export default ({ services }) => ({
  idle: {
    description: 'Open, waiting for what the person types.',
    on: { typed: { actions: rememberText, target: 'waiting' } },
  },
  waiting: {
    after: {
      250: [
        { guard: enoughText, target: 'searching' },
        { actions: forgetResults, target: 'idle' },
      ],
    },
    description: 'Open. What was typed is searched once the person pauses for 250 ms, if it is two characters or more.',
    on: { typed: { actions: rememberText, reenter: true, target: 'waiting' } },
  },
  searching: {
    description: 'The products are searched for the last text. Typing again drops the search.',
    invoke: {
      input: query,
      onDone: { actions: rememberResults, target: 'idle' },
      onError: 'idle',
      src: services.products.search,
    },
    on: { typed: { actions: rememberText, target: 'waiting' } },
  },
});

// ---- What the states gallery shows each state with --------------------------------------------

const lamp = {
  category: 'lighting',
  description: '',
  id: 22,
  price: 10,
  rating: 4,
  stock: 1,
  thumbnail: '',
  title: 'Arc Floor Lamp',
  version: 1,
};

export const examples = {
  idle: {
    context: { results: [lamp], text: 'lamp' },
    props: { onClose: () => undefined, standalone: true, title: 'Commands' },
  },
  searching: { context: { text: 'lamp' }, props: { onClose: () => undefined, standalone: true, title: 'Commands' } },
  waiting: { context: { text: 'lamp' }, props: { onClose: () => undefined, standalone: true, title: 'Commands' } },
};
