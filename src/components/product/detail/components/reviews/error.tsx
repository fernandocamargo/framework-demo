import { Button } from 'react-aria-components'

export default ({ className, error, resetErrorBoundary }) => (
  <section className={className} aria-label="Reviews">
    <div className="notice" data-tone="warn" role="alert">
      <span className="icon" data-icon="alert" />
      <div>
        <p>The reviews could not be read: {error.message}</p>
        <div className="actions">
          <Button onPress={resetErrorBoundary}>Try again</Button>
        </div>
      </div>
    </div>
  </section>
)
