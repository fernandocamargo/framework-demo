import { Button } from 'react-aria-components';
import { createPortal } from 'react-dom';

// The tour's button starts it; the panel walks through the steps. The panel goes to the end of the
// page and is marked top layer, so it stays usable over a dialog a step opens.
export default ({
  back,
  canBack,
  canNext,
  className,
  close,
  count,
  error,
  heading,
  index,
  label,
  next,
  open,
  progress,
  send,
  text,
  title,
}) => (
  <div className={className}>
    <Button aria-describedby="tour-shortcut" aria-expanded={open} onPress={() => send({ type: 'start' })}>
      {label}
      <span hidden id="tour-shortcut">
        T
      </span>
    </Button>
    {open &&
      createPortal(
        <aside
          aria-label={heading}
          className={className}
          data-react-aria-top-layer="true"
          itemScope
          itemType="https://schema.org/HowTo"
        >
          <header>
            <h2 itemProp="name">{heading}</h2>
            <Button onPress={() => send({ type: 'leave' })} slot="close">
              {close}
            </Button>
          </header>
          <div itemProp="step" itemScope itemType="https://schema.org/HowToStep">
            <meta content={String(index)} itemProp="position" />
            <h3 itemProp="name">{title}</h3>
            <p itemProp="text">{text}</p>
          </div>
          <progress max={count} value={index}>
            {progress}
          </progress>
          {error && <p role="alert">{error}</p>}
          <menu>
            <li>
              <Button isDisabled={!canBack} onPress={() => send({ type: 'back' })}>
                {back}
              </Button>
            </li>
            <li>
              <Button isDisabled={!canNext} onPress={() => send({ type: 'next' })}>
                {next}
              </Button>
            </li>
          </menu>
        </aside>,
        document.body,
      )}
  </div>
);
