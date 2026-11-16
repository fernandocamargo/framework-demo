export const type =
  ({ state }) =>
  (text: string) =>
    state.send({ text, type: 'typed' });
