// The tour's commands send the same chart events as its buttons and keys.
export const startTour =
  ({ state }) =>
  () =>
    state.send({ type: 'start' });
export const leaveTour =
  ({ state }) =>
  () =>
    state.send({ type: 'leave' });
export const goBack =
  ({ state }) =>
  () =>
    state.send({ type: 'back' });
export const goNext =
  ({ state }) =>
  () =>
    state.send({ type: 'next' });
