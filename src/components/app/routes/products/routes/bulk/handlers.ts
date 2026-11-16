import type { Key } from 'react-aria-components';

// The wizard's commands send the chart's events its buttons and its dialogs' dismissal send, and
// write the fields the person fills in.
export const dismiss =
  ({ state }) =>
  (open: boolean) => {
    if (!open) state.send({ type: 'close' });
  };
export const dismissLargeChange =
  ({ state }) =>
  (open: boolean) => {
    if (!open) state.send({ type: 'back' });
  };
export const chooseCategory =
  ({ state }) =>
  (key: Key | null) =>
    state.send({ category: String(key), type: 'categoryChanged' });
export const retryLoad =
  ({ state }) =>
  () =>
    state.send({ type: 'retry' });
export const selectProducts =
  ({ form }) =>
  (ids: string[]) =>
    form.set('selected', ids.map(Number));
export const closeWizard =
  ({ state }) =>
  () =>
    state.send({ type: 'close' });
export const goBack =
  ({ state }) =>
  () =>
    state.send({ type: 'back' });
export const goNext =
  ({ state }) =>
  () =>
    state.send({ type: 'next' });
export const setDirection =
  ({ form }) =>
  (value: string) =>
    form.set('direction', value as 'decrease' | 'increase');
export const setPercent =
  ({ form }) =>
  (value: number) =>
    form.set('percent', value);
export const applyChange =
  ({ state }) =>
  () =>
    state.send({ type: 'apply' });
export const retryFailed =
  ({ state }) =>
  () =>
    state.send({ type: 'retryFailed' });
export const confirmLargeChange =
  ({ state }) =>
  () =>
    state.send({ type: 'confirm' });
