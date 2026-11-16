import { Button } from 'react-aria-components';

import Commands from './components/commands';
import Search from './components/search';

// The button shows the key it answers. While the palette is open, the dialog's shell and its search
// are components of their own, so the button does not render again each time the results change.
// The search is named here, as the shell's content: this render is on the page from the start, so
// the search's files and messages have loaded by the time the palette opens.
export default ({ className, handlers, label, open, shortcut, title }) => (
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
    {open && (
      <Commands onClose={handlers.closePalette} title={title}>
        <Search onClose={handlers.closePalette} title={title} />
      </Commands>
    )}
  </>
);
