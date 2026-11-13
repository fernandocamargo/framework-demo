// What the session's render shows: who is signed in, their role and how long the access token
// has left, and the sign-in dialog when the page asks for it. The role is the one the backend's
// permissions name (`acl`), not the session's: DummyJSON's sign-in answers none.
import { DEMOS } from './form'

export type Props = {
  /** Whether the page asks for the sign-in dialog: the address did, or a change that needs a session. */
  asked: boolean
  /** Why it asks, when a change needs a session. */
  reason: string | null
}

export default ({ asked, reason, state, form, i18n, acl }) => {
  const { user: session, expiresAt, now, error } = state.context
  const signedIn = state.signedIn || state.refreshing
  const seconds = Math.max(0, Math.round((expiresAt - now) / 1000))
  return {
    i18n,
    send: state.send,
    values: form.values,
    set: form.set,
    signedIn,
    name: session ? `${session.firstName} ${session.lastName}` : '',
    picture: session?.image ?? '',
    role: signedIn && acl.role !== 'guest' ? i18n.role({ role: acl.role }) : null,
    token: state.refreshing ? i18n.token.refreshing : i18n.token.left({ seconds }),
    refreshing: state.refreshing,
    dialogOpen: asked && (state.signedOut || state.signingIn || state.expired),
    signingIn: state.signingIn,
    notice: state.expired ? i18n.expired : reason,
    accounts: DEMOS.map(({ username, name, role }) => ({ username, label: i18n.dialog.account({ name, role }) })),
    error,
  }
}
