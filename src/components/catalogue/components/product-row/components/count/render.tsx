import { Button, Group } from 'react-aria-components';

export default ({ className, disabled, handlers, label, less, more, sending }) => (
  <Group aria-busy={sending || undefined} aria-label={label} className={className}>
    <Button aria-label={less} isDisabled={disabled} onPress={handlers.less}>
      −
    </Button>
    <Button aria-label={more} onPress={handlers.more}>
      +
    </Button>
  </Group>
);
