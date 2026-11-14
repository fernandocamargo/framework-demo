// The command palette: closed, or open and searching the products for what is typed, once the
// person pauses. An answer that comes after the person typed on is dropped with its search.

import type { Listed, Query } from '@/services/products/types';

export const description = 'The command palette: closed, or open with the products found for what is typed.';

export const context = () => ({ results: [] as Listed[], text: '' });

export type Events = { typed: { text: string } };

export const rememberText = ({ event }) => ({ text: event.text });
export const rememberResults = ({ event }) => ({ results: event.output.items.slice(0, 6) as Listed[] });
export const forgetResults = () => ({ results: [] as Listed[] });
export const forgetAll = () => ({ results: [] as Listed[], text: '' });
export const enoughText = ({ context }) => context.text.trim().length >= 2;
export const query = ({ context }): Query => ({
  category: '',
  order: 'asc',
  page: 1,
  q: context.text.trim(),
  sort: 'title',
});

const close = { actions: forgetAll, target: 'closed' };

export default ({ services }) => ({
  closed: {
    description: 'Closed. The button or the key opens it.',
    on: { open: 'idle' },
  },
  idle: {
    description: 'Open, waiting for what the person types.',
    on: { close, typed: { actions: rememberText, target: 'waiting' } },
  },
  waiting: {
    after: {
      250: [
        { guard: enoughText, target: 'searching' },
        { actions: forgetResults, target: 'idle' },
      ],
    },
    description: 'Open. What was typed is searched once the person pauses for 250 ms, if it is two characters or more.',
    on: { close, typed: { actions: rememberText, reenter: true, target: 'waiting' } },
  },
  searching: {
    description: 'The products are searched for the last text. Typing again drops the search.',
    invoke: {
      input: query,
      onDone: { actions: rememberResults, target: 'idle' },
      onError: 'idle',
      src: services.products.search,
    },
    on: { close, typed: { actions: rememberText, target: 'waiting' } },
  },
});
