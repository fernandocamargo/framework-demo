import type { Key } from 'react-aria-components';

// The wizard's commands send the chart's events its buttons and its dialogs' dismissal send, and
// write the fields the person fills in.
export const dismiss =
  ({ state: { send } }) =>
  (open: boolean) => {
    if (!open) send({ type: 'close' });
  };
export const dismissLargeChange =
  ({ state: { send } }) =>
  (open: boolean) => {
    if (!open) send({ type: 'back' });
  };
export const chooseCategory =
  ({ state: { send } }) =>
  (key: Key | null) =>
    send({ category: String(key), type: 'categoryChanged' });
export const retryLoad =
  ({ state: { send } }) =>
  () =>
    send({ type: 'retry' });
export const selectProducts =
  ({ form }) =>
  (ids: string[]) =>
    form.set('selected', ids.map(Number));
export const closeWizard =
  ({ state: { send } }) =>
  () =>
    send({ type: 'close' });
export const goBack =
  ({ state: { send } }) =>
  () =>
    send({ type: 'back' });
export const goNext =
  ({ state: { send } }) =>
  () =>
    send({ type: 'next' });
export const setDirection =
  ({ form }) =>
  (value: string) =>
    form.set('direction', value as 'decrease' | 'increase');
export const setPercent =
  ({ form }) =>
  (value: number) =>
    form.set('percent', value);
export const applyChange =
  ({ state: { send } }) =>
  () =>
    send({ type: 'apply' });
export const retryFailed =
  ({ state: { send } }) =>
  () =>
    send({ type: 'retryFailed' });
export const confirmLargeChange =
  ({ state: { send } }) =>
  () =>
    send({ type: 'confirm' });
