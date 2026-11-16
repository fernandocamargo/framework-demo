// The palette stays open while its search child handles each query.

export const description = 'The command palette: closed, or open with its search in the dialog.';

export default () => ({
  closed: {
    description: 'Closed. The button or the key opens it.',
    on: { open: 'open' },
  },
  open: {
    description: 'Open. The search child owns what is typed and found.',
    on: { close: 'closed' },
  },
});
