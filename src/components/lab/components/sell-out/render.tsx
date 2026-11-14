import { Button } from 'react-aria-components'

export default ({ className, label, enabled, sellOut }) => (
  <Button className={`react-aria-Button ${className}`} isDisabled={!enabled} onPress={() => sellOut()}>
    {label}
  </Button>
)
