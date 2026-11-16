import { Button } from 'react-aria-components';

import Commands from './components/commands';

// The button shows the key it answers. The dialog and its search change below it.
export default ({ className, handlers, label, open, shortcut }) => (
  <>
    <Button
      aria-describedby="palette-shortcut"
      aria-label={label}
      className={`react-aria-Button ${className}`}
      data-react-aria-top-layer="true"
      onPress={handlers.openPalette}
    >
      <kbd id="palette-shortcut">{shortcut}</kbd>
    </Button>
    {open && <Commands onClose={handlers.closePalette} />}
  </>
);
