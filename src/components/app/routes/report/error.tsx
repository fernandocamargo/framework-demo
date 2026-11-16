import { Button } from 'react-aria-components';

// Reading the report, an action that failed; it can be tried again.
export default ({ className, error, i18n, resetErrorBoundary }) => (
  <section className={className}>
    <header>
      <h2>{i18n.title}</h2>
    </header>
    <div itemScope itemType="https://schema.org/Action" role="alert">
      <link href="https://schema.org/FailedActionStatus" itemProp="actionStatus" />
      <p itemProp="error">{i18n.failed.message({ message: error.message })}</p>
      <menu>
        <li>
          <Button onPress={resetErrorBoundary}>{i18n.failed.retry}</Button>
        </li>
      </menu>
    </div>
  </section>
);
