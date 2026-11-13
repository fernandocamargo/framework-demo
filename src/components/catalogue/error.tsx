import { Button } from 'react-aria-components'

export default ({ className, i18n, error, resetErrorBoundary }) => (
  <section className={className}>
    <div className="top">
      <h2>{i18n.title}</h2>
    </div>
    <div className="notice" data-tone="danger" role="alert">
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
