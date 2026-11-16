// A visible Inspector tab reads its source at mount and once a second until it unmounts.

export const description = 'Show recent app activity while the Inspector tab is visible.';

export const context = ({ clients }) => ({ entries: clients.tracker.recent() });

export const remember = ({ event }) => ({ entries: event.output });

export default ({ clients }) => ({
  visible: {
    after: { 1000: { reenter: true, target: 'visible' } },
    invoke: { onDone: { actions: remember }, src: async () => clients.tracker.recent() },
  },
});
