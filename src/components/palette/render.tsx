import { Button } from 'react-aria-components';

import Commands from './components/commands';

// The button shows the key it answers. While the palette is open, the commands are a component of
// their own, so the button does not render again each time the results change.
export default ({ className, label, open, results, searching, send, shortcut, text }) => (
  <>
    <Button
      aria-describedby="palette-shortcut"
      aria-label={label}
      className={`react-aria-Button ${className}`}
      data-react-aria-top-layer="true"
      onPress={() => send({ type: 'open' })}
    >
      <kbd id="palette-shortcut">{shortcut}</kbd>
    </Button>
    {open && (
      <Commands
        onClose={() => send({ type: 'close' })}
        onType={(next) => send({ text: next, type: 'typed' })}
        results={results}
        searching={searching}
        text={text}
      />
    )}
  </>
);
