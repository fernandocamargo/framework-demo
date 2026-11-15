import type { Key } from 'react-aria-components';

// The editor's events send the flow's events, and the fields write into the form.
export const dismiss =
  ({ state }) =>
  (open: boolean) => {
    if (!open) state.send({ type: 'close' });
  };
export const close =
  ({ state }) =>
  () =>
    state.send({ type: 'close' });
export const retry =
  ({ state }) =>
  () =>
    state.send({ type: 'retry' });
export const save =
  ({ state }) =>
  (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    state.send({ type: 'save' });
  };
export const takeTheirs =
  ({ state }) =>
  () =>
    state.send({ type: 'takeTheirs' });
export const keepMine =
  ({ state }) =>
  () =>
    state.send({ type: 'keepMine' });
export const backToEditing =
  ({ state }) =>
  () =>
    state.send({ type: 'edit' });
export const keepEditing =
  ({ state }) =>
  () =>
    state.send({ type: 'keepEditing' });
export const dismissQuestion =
  ({ state }) =>
  (open: boolean) => {
    if (!open) state.send({ type: 'keepEditing' });
  };
export const discard =
  ({ state }) =>
  () =>
    state.send({ type: 'discard' });
export const setTitle =
  ({ form }) =>
  (value: string) =>
    form.set('title', value);
export const setDescription =
  ({ form }) =>
  (value: string) =>
    form.set('description', value);
export const setCategory =
  ({ form }) =>
  (key: Key | null) =>
    form.set('category', String(key));
export const setBrand =
  ({ form }) =>
  (value: string) =>
    form.set('brand', value);
export const setPrice =
  ({ form }) =>
  (value: number) =>
    form.set('price', value);
export const setStock =
  ({ form }) =>
  (value: number) =>
    form.set('stock', value);
