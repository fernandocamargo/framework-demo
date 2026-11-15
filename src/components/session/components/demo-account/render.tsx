import { Button } from 'react-aria-components';

export default ({ account, handlers }) => (
  <li>
    <Button onPress={handlers.fill}>{account.label}</Button>
  </li>
);
