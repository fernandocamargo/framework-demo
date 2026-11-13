import { Button } from 'react-aria-components'

export default ({ className, i18n, error, resetErrorBoundary }) => (
  <section className={className} aria-label={i18n.label}>
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
)
