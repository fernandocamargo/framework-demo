// The page's rules. Changing the catalogue needs a session: when the address opens one of
// those dialogs and nobody is signed in, the sign-in dialog is asked for, on top of it.
export type Props = {
  /** Whether the address has changed and its page is still being read. */
  navigating: boolean
}

export default ({ navigating, async: { default: page } }) => {
  const { dialogs, session } = page
  const changing = dialogs.edit !== null || dialogs.create || dialogs.remove !== null || dialogs.bulk
  return {
    navigating,
    dialogs,
    world: page.world === 'memory' ? 'Memory world' : 'DummyJSON',
    askToSignIn: !session && (page.signin || changing),
    signInReason: !session && changing ? 'Sign in to change the catalogue.' : null,
  }
}
