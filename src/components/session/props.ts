// What the session's render shows: who is signed in, their role and how long the access token
// has left, and the sign-in dialog when the page asks for it. The role is the one the backend's
// permissions name (`acl`), not the session's: DummyJSON's sign-in answers none.

import { DEMOS } from './form';

export type Props = {
  /** Whether the page asks for the sign-in dialog: the address did, or a change that needs a session. */
  asked: boolean;
  /** Why it asks, when a change needs a session. */
  reason: null | string;
};

export default ({ acl, asked, form, i18n, reason, state }) => {
  const { error, expiresAt, now, user: session } = state.context;
  const signedIn = state.signedIn || state.refreshing;
  const seconds = Math.max(0, Math.round((expiresAt - now) / 1000));
  return {
    accounts: DEMOS.map(({ name, role, username }) => ({ label: i18n.dialog.account({ name, role }), username })),
    dialogOpen: asked && (state.signedOut || state.signingIn || state.expired),
    error,
    i18n,
    name: session ? `${session.firstName} ${session.lastName}` : '',
    notice: state.expired ? i18n.expired : reason,
    picture: session?.image ?? '',
    refreshing: state.refreshing,
    role: signedIn && acl.role !== 'guest' ? i18n.role({ role: acl.role }) : null,
    signedIn,
    signingIn: state.signingIn,
    token: state.refreshing ? i18n.token.refreshing : i18n.token.left({ seconds }),
    values: form.values,
  };
};
