import { Button } from 'react-aria-components';

export default ({ className, enabled, handlers, label }) => (
  <Button className={`react-aria-Button ${className}`} isDisabled={!enabled} onPress={handlers.sellOut}>
    {label}
  </Button>
);
