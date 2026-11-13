// The session. The client holds the tokens and refreshes them when a request meets a 401;
// these operations are what the app's flows call.
import type { User } from 'framework'
import type { Credentials } from '@/clients/dummyjson/http'

/** Who is signed in, and until when the access token is good; null when nobody is. */
export const session =
  ({ clients: { api } }) =>
  async () =>
    api.session.current()

/**
 * The signed-in person's profile: who they are, with their role. DummyJSON's login answers no
 * role, so it comes from `/auth/me`, with the access token.
 */
export const profile =
  ({ clients: { api } }) =>
  async () => {
    const { id, username, firstName, lastName, image, role } = await api.get<User>('/auth/me', { auth: true })
    return { id, username, firstName, lastName, image, role } satisfies User
  }

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
