// A dialog's frame: the overlay and the modal, with no read of its own. It shows at once and stays
// while the dialog inside waits for its read, so it opens once, and the dialog's placeholder, its
// content and its error all show in it.

import { createElement, type ReactNode } from 'react';
import { Dialog } from 'react-aria-components';

export type Props = {
  /** The dialog, which renders its own `Dialog`. */
  children: ReactNode;
  /** Whether another dialog is open over this one (a route's dialog under its child route's). */
  covered?: boolean;
  /** What closing it does: a click outside, Escape. */
  onClose: () => void;
};

export default ({ children, covered = false }) => ({ children, covered });

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'A product': {
    props: {
      children: createElement(
        Dialog,
        { 'aria-label': 'Arc Floor Lamp' },
        createElement(
          'article',
          { itemScope: true, itemType: 'https://schema.org/Product' },
          createElement('h2', null, createElement('span', { itemProp: 'name' }, 'Arc Floor Lamp')),
          createElement('p', { itemProp: 'description' }, 'A modal holding a product is wide: pictures and reviews.'),
        ),
      ),
      onClose: () => undefined,
    },
  },
  'A question': {
    props: {
      children: createElement(
        Dialog,
        { 'aria-label': 'Delete this product?', role: 'alertdialog' },
        createElement('h2', null, 'Delete this product?'),
        createElement('p', null, 'A modal holding a question or a failure is small.'),
      ),
      onClose: () => undefined,
    },
  },
};
