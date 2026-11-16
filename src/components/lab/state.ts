// The network lab's panel: each visible tab owns its own activity read.

export const description = 'Show the network lab.';

export const context = () => ({ radioName: crypto.randomUUID() });

export default () => ({ closed: { on: { toggle: 'open' } }, open: { on: { toggle: 'closed' } } });
