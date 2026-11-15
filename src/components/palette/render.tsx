import { Button } from 'react-aria-components';

import Commands from './components/commands';

// The button shows the key it answers. While the palette is open, the commands are a component of
// their own, so the button does not render again each time the results change.
export default ({ className, handlers, label, open, results, searching, shortcut, text }) => (
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
      <Commands
        onClose={handlers.closePalette}
        onType={handlers.search}
        results={results}
        searching={searching}
        text={text}
      />
    )}
  </>
);
