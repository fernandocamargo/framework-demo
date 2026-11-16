// The modal shell receives the close action; its search child owns the changing content.

export type Props = { onClose: () => void };

export default ({ i18n, onClose }) => ({ i18n, onClose });

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'The commands, with a search': { props: { onClose: () => undefined } },
};
