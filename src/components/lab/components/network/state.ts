// A visible API client tab reads its source at mount and once a second until it unmounts.

export const description = "Show the API client's latest requests while its tab is visible.";

export const context = ({ clients }) => ({ entries: clients.api.lab.activity() });

export const remember = ({ event }) => ({ entries: event.output });

export default ({ clients }) => ({
  visible: {
    after: { 1000: { reenter: true, target: 'visible' } },
    invoke: { onDone: { actions: remember }, src: async () => clients.api.lab.activity() },
  },
});
