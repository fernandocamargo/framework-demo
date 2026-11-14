// A dialog's frame: the overlay and the modal, with no read of its own. It shows at once and stays
// while the dialog inside waits for its read, so it opens once, and the dialog's placeholder, its
// content and its error all show in it.

import { createElement, type ReactNode } from 'react'
import { Dialog, Heading } from 'react-aria-components'

export type Props = {
  size: 'small' | 'large'
  /** What closing it does: a click outside, Escape. */
  onClose: () => void
  /** The dialog, which renders its own `Dialog`. */
  children: ReactNode
}

export default ({ size, onClose, children }) => ({ size, onClose, children })

const dialog = (title: string, text: string) => createElement(Dialog, null, createElement(Heading, { slot: 'title' }, title), createElement('p', null, text))

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  Small: { props: { size: 'small', onClose: () => undefined, children: dialog('A question', 'A small modal holds a question or a failure.') } },
  Large: { props: { size: 'large', onClose: () => undefined, children: dialog('A product', 'A large modal holds a product, its pictures and its reviews.') } },
}
