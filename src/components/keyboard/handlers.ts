export const openKeys =
  ({ state }) =>
  () =>
    state.send({ type: 'open' });
export const closeKeys =
  ({ state }) =>
  () =>
    state.send({ type: 'close' });
