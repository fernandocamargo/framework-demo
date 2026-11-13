// The session. The client holds the tokens and refreshes them when a request meets a 401;
// these operations are what the app's flows call.
import type { Credentials } from '@/clients/dummyjson/http'

/** Who is signed in, and until when the access token is good; null when nobody is. */
export const session =
  ({ clients: { api } }) =>
  async () =>
    api.session.current()

export const signIn =
  ({ clients: { api } }) =>
  (credentials: Credentials) =>
    api.session.signIn(credentials)

/** A new access token, ahead of the old one's expiry. Rejects with a `SessionError` when the session is over. */
export const refresh =
  ({ clients: { api } }) =>
  () =>
    api.session.refresh()

export const signOut =
  ({ clients: { api } }) =>
  async () =>
    api.session.signOut()
