// The network lab's read and its operations. The default export reads the API client's fault
// settings, and which product is being edited (for the "sold out elsewhere" button). Each named
// export reaches the render as `async.<name>`, a function with `pending`, `error` and `data`.
import type { Settings } from '@/clients/dummyjson/http'

export default async ({ services, route }) => ({ settings: await services.lab.settings(), editing: route.edit })

export const change =
  ({ services }) =>
  (changes: Partial<Settings>) =>
    services.lab.change(changes)

export const expireToken = ({ services }) => services.lab.expireToken()
export const breakRefresh = ({ services }) => services.lab.breakRefresh()
export const forgetChanges = ({ services }) => services.products.reset()

/** Somebody else's save of the product being edited: its last unit sells. The editor's next save is a conflict. */
export const sellOut = ({ services, route }) => (route.edit === null ? Promise.resolve() : services.products.sellOut(route.edit))
