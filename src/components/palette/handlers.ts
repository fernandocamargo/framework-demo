export const openPalette =
  ({ state }) =>
  () =>
    state.send({ type: 'open' });

export const closePalette =
  ({ state }) =>
  () =>
    state.send({ type: 'close' });
