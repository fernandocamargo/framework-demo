// The network lab's operations: the faults the API client applies, and what the client and the
// framework's pipelines have seen lately.
import type { Settings } from '@/clients/dummyjson/http'

export const settings =
  ({ clients: { api } }) =>
  async () =>
    api.lab.settings()

export const change =
  ({ clients: { api } }) =>
  async (changes: Partial<Settings>) =>
    api.lab.change(changes)

/** The API client's latest requests, retries and refreshes, and the pipelines' latest interactions and failures. */
export const activity =
  ({ clients: { api, tracker } }) =>
  async () => ({ network: api.lab.activity(), tracked: tracker.recent() })

export const expireToken =
  ({ clients: { api } }) =>
  async () =>
    api.lab.expireToken()

export const breakRefresh =
  ({ clients: { api } }) =>
  async () =>
    api.lab.breakRefresh()
