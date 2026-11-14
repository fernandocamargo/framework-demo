import { Button } from 'react-aria-components';

export default ({ className, enabled, label, sellOut }) => (
  <Button className={`react-aria-Button ${className}`} isDisabled={!enabled} onPress={() => sellOut()}>
    {label}
  </Button>
);
