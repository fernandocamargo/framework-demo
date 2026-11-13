import { Button } from 'react-aria-components'

export default ({ className, error, resetErrorBoundary }) => (
  <section className={className}>
    <div className="top">
      <h2>Products</h2>
    </div>
    <div className="notice" data-tone="danger" role="alert">
      <span className="icon" data-icon="alert" />
      <div>
        <p>The catalogue could not be read: {error.message}</p>
        <div className="actions">
          <Button onPress={resetErrorBoundary}>Try again</Button>
        </div>
      </div>
    </div>
  </section>
)
