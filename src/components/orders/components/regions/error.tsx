import { Button } from 'react-aria-components';

// Reading the orders for the map failed; it can be tried again.
export default ({ className, error, i18n, resetErrorBoundary }) => (
  <figure className={className}>
    <figcaption>{i18n.label}</figcaption>
    <div itemScope itemType="https://schema.org/ReadAction" role="alert">
      <link href="https://schema.org/FailedActionStatus" itemProp="actionStatus" />
      <p itemProp="error">{i18n.failed.message({ message: error.message })}</p>
      <menu>
        <li>
          <Button onPress={resetErrorBoundary}>{i18n.failed.retry}</Button>
        </li>
      </menu>
    </div>
  </figure>
);
