import { Button } from 'react-aria-components'
import List from './components/list'

// The list is a component of its own, shown only while open: only it reads the keys on screen,
// so the page does not render the button again each time they change.
export default ({ className, label, open, send }) => (
  <>
    <Button className={`react-aria-Button ${className}`} data-variant="icon" aria-label={label} aria-keyshortcuts="?" onPress={() => send({ type: 'open' })}>
      <kbd>?</kbd>
    </Button>
    {open && <List onClose={() => send({ type: 'close' })} />}
  </>
)
