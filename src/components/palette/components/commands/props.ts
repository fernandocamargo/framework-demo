// The modal shell: the palette gives it its name, what closes it and the search it holds.

import { createElement, type ReactNode } from 'react';

export type Props = {
  /** The search, which changes without the shell. */
  children: ReactNode;
  /** What closing it does: a click outside, Escape. */
  onClose: () => void;
  /** The dialog's accessible name. */
  title: string;
};

export default ({ children, title }) => ({ children, title });

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'The commands, with a search': {
    props: {
      children: createElement('search', null, createElement('input', { 'aria-label': 'Command or product' })),
      onClose: () => undefined,
      title: 'Commands',
    },
  },
};
