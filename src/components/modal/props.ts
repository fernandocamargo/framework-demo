// A dialog's frame: the overlay and the modal, with no read of its own. It shows at once and stays
// while the dialog inside waits for its read, so it opens once, and the dialog's placeholder, its
// content and its error all show in it.
import type { ReactNode } from 'react'

export type Props = {
  size: 'small' | 'large'
  /** What closing it does: a click outside, Escape. */
  onClose: () => void
  /** The dialog, which renders its own `Dialog`. */
  children: ReactNode
}

export default ({ size, onClose, children }) => ({ size, onClose, children })
