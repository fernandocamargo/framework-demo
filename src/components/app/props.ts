// The page's rules. Changing the catalogue needs a session: when the address opens one of
// those dialogs and nobody is signed in, the sign-in dialog is asked for, on top of it.
export type Props = {
  /** Whether the address has changed and its page is still being read. */
  navigating: boolean;
};

export default ({ async: { default: page }, i18n, navigating }) => {
  const { dialogs, session } = page;
  const changing = dialogs.edit !== null || dialogs.create || dialogs.remove !== null || dialogs.bulk;
  return {
    askToSignIn: !session && (page.signin || changing),
    brand: i18n.brand,
    dialogs,
    navigating,
    signInReason: !session && changing ? i18n.signIn.reason : null,
    skip: i18n.skip,
    states: i18n.states,
    world: page.world === 'memory' ? i18n.world.memory : i18n.world.dummyjson,
  };
};

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'A product open': { props: { navigating: false }, route: { view: 22 } },
  'Reading the next page': { props: { navigating: true } },
  'The page': { props: { navigating: false } },
};
