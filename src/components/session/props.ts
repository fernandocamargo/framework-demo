import type { ReactNode } from 'react'
import { DEMO } from './form'

// What the session's render shows: who is signed in and how long the access token has left,
// and the sign-in dialog when the page asks for it.

export type Props = {
  /** Whether the page asks for the sign-in dialog: the address did, or a change that needs a session. */
  asked: boolean
  /** Why it asks, when a change needs a session. */
  reason: string | null
}

export default ({ asked, reason, state, form, i18n }) => {
  const { user, expiresAt, now, error } = state.context
  const signedIn = state.signedIn || state.refreshing
  const seconds = Math.max(0, Math.round((expiresAt - now) / 1000))
  return {
    i18n,
    /** The hint, with what a `<code>` becomes: `hint(code)`. */
    hint: (code: (chunks: ReactNode[]) => ReactNode) => i18n.dialog.hint({ ...DEMO, code }),
    send: state.send,
    values: form.values,
    set: form.set,
    signedIn,
    name: user ? `${user.firstName} ${user.lastName}` : '',
    picture: user?.image ?? '',
    token: state.refreshing ? i18n.token.refreshing : i18n.token.left({ seconds }),
    refreshing: state.refreshing,
    dialogOpen: asked && (state.signedOut || state.signingIn || state.expired),
    signingIn: state.signingIn,
    notice: state.expired ? i18n.expired : reason,
    error,
  }
}
