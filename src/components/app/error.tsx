import { Button } from 'react-aria-components'

export default ({ className, error, resetErrorBoundary }) => (
  <div className={className}>
    <main>
      <div className="notice" data-tone="danger" role="alert">
        <span className="icon" data-icon="alert" />
        <div>
          <p>The page could not start: {error.message}</p>
          <div className="actions">
            <Button onPress={resetErrorBoundary}>Try again</Button>
          </div>
        </div>
      </div>
    </main>
  </div>
)
