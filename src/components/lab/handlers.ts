export const toggleLab =
  ({ state }) =>
  () =>
    state.send({ type: 'toggle' });
export const setLatency =
  ({ async }) =>
  (value: number | number[]) =>
    async.change({ latency: value as number });
export const setFailureRate =
  ({ async }) =>
  (value: number | number[]) =>
    async.change({ failureRate: (value as number) / 100 });
export const forceStatus =
  ({ async }) =>
  (value: string) =>
    async.change({ force: Number(value) as 0 | 429 | 500 });
export const setTokenMinutes =
  ({ async }) =>
  (value: string) =>
    async.change({ tokenMinutes: Number(value) });
export const setOffline =
  ({ async }) =>
  (selected: boolean) =>
    async.change({ offline: selected });
export const expireToken =
  ({ async }) =>
  () =>
    async.expireToken();
export const breakRefresh =
  ({ async }) =>
  () =>
    async.breakRefresh();
export const forgetChanges =
  ({ async }) =>
  () =>
    async.forgetChanges();
