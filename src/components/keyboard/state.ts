// The list of keys: closed, or open over the page.
export const description = 'The list of the keys on screen, opened with `?`.';

export default () => ({
  closed: { on: { open: 'open' } },
  open: { on: { close: 'closed' } },
});
