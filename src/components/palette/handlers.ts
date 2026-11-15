export const openPalette =
  ({ state }) =>
  () =>
    state.send({ type: 'open' });
export const closePalette =
  ({ state }) =>
  () =>
    state.send({ type: 'close' });
export const search =
  ({ state }) =>
  (next: string) =>
    state.send({ text: next, type: 'typed' });
