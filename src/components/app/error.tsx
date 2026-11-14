import { Button } from 'react-aria-components';

// The page could not show, as an action that failed; it can be tried again.
export default ({ className, error, i18n, resetErrorBoundary }) => (
  <div className={className}>
    <main>
      <div itemScope itemType="https://schema.org/Action" role="alert">
        <link href="https://schema.org/FailedActionStatus" itemProp="actionStatus" />
        <p itemProp="error">{i18n.failed.message({ message: error.message })}</p>
        <menu>
          <li>
            <Button onPress={resetErrorBoundary}>{i18n.failed.retry}</Button>
          </li>
        </menu>
      </div>
    </main>
  </div>
);
