export const less =
  ({ async: { setStock }, id, stock }) =>
  () =>
    setStock(id, stock - 1);

export const more =
  ({ async: { setStock }, id, stock }) =>
  () =>
    setStock(id, stock + 1);
