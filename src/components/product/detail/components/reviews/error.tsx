import { Button } from 'react-aria-components';

export default ({ className, error, i18n, resetErrorBoundary }) => (
  <section aria-label={i18n.label} className={className}>
    <div className="notice" data-tone="warn" role="alert">
      <span className="icon" data-icon="alert" />
      <div>
        <p>{i18n.failed.message({ message: error.message })}</p>
        <div className="actions">
          <Button onPress={resetErrorBoundary}>{i18n.failed.retry}</Button>
        </div>
      </div>
    </div>
  </section>
);
