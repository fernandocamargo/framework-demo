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

// WebKit pointer activation does not retain native radio focus.
export const focusRadio = () => (event: React.MouseEvent<HTMLInputElement>) => event.currentTarget.focus();

export const forceStatus =
  ({ async }) =>
  (event: React.ChangeEvent<HTMLInputElement>) =>
    // SAFETY: The native force radios supply only 0, 429 or 500.
    async.change({ force: Number(event.currentTarget.value) as 0 | 429 | 500 });

export const setTokenMinutes =
  ({ async }) =>
  (event: React.ChangeEvent<HTMLInputElement>) =>
    async.change({ tokenMinutes: Number(event.currentTarget.value) });

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
