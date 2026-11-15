import { Button } from 'react-aria-components';

import List from './components/list';

// The list is a component of its own, shown only while open: only it reads the keys on screen,
// so the page does not render the button again each time they change.
export default ({ className, handlers, label, open }) => (
  <>
    <Button
      aria-describedby="keyboard-shortcut"
      aria-label={label}
      className={`react-aria-Button ${className}`}
      onPress={handlers.openKeys}
    >
      <kbd id="keyboard-shortcut">?</kbd>
    </Button>
    {open && <List onClose={handlers.closeKeys} />}
  </>
);
