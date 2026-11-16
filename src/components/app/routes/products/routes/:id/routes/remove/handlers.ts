// The dialog's events send the flow's events.
export const dismiss =
  ({ state }) =>
  (open: boolean) => {
    if (!open) state.send({ type: 'cancel' });
  };
export const cancel =
  ({ state }) =>
  () =>
    state.send({ type: 'cancel' });
export const confirm =
  ({ state }) =>
  () =>
    state.send({ type: 'confirm' });
