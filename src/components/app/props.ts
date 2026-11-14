// The page's rules. Changing the catalogue needs a session: when the address opens one of
// those dialogs and nobody is signed in, the sign-in dialog is asked for, on top of it.
export type Props = {
  /** Whether the address has changed and its page is still being read. */
  navigating: boolean
}

export default ({ navigating, i18n, async: { default: page } }) => {
  const { dialogs, session } = page
  const changing = dialogs.edit !== null || dialogs.create || dialogs.remove !== null || dialogs.bulk
  return {
    navigating,
    dialogs,
    brand: i18n.brand,
    skip: i18n.skip,
    world: page.world === 'memory' ? i18n.world.memory : i18n.world.dummyjson,
    states: i18n.states,
    askToSignIn: !session && (page.signin || changing),
    signInReason: !session && changing ? i18n.signIn.reason : null,
  }
}
