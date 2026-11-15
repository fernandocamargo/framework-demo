// One demo account of the sign-in dialog: what its button says, and the username it fills in.
export type Props = {
  account: { label: string; username: string };
  /** What the parent does with the username. */
  fill: (username: string) => void;
};

export default ({ account }) => ({ account });

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'A demo account': { props: { account: { label: 'Emily, admin', username: 'emilys' }, fill: () => undefined } },
};
