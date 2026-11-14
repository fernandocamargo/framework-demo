// The network lab's read and its operations. The default export reads the API client's fault
// settings, and nothing of the address, so a change of address does not render the lab. Each
// named export reaches the render as `async.<name>`, a function with `pending`, `error` and `data`.

import type { Settings } from '@/clients/dummyjson/http';

export default async ({ services }) => ({ settings: await services.lab.settings() });

export const change =
  ({ services }) =>
  (changes: Partial<Settings>) =>
    services.lab.change(changes);

export const expireToken = ({ services }) => services.lab.expireToken();
export const breakRefresh = ({ services }) => services.lab.breakRefresh();
export const forgetChanges = ({ services }) => services.products.reset();
