import { Button, Dialog, Link } from 'react-aria-components';

// Inside the modal the page opened (components/modal), in place of the order.
export default ({ className, closeHref, error, i18n, resetErrorBoundary }) => (
  <Dialog aria-label={i18n.failed.title} className={`react-aria-Dialog ${className}`} role="alertdialog">
    <h2>{i18n.failed.title}</h2>
    <p>{error.message}</p>
    <footer>
      <Link href={closeHref}>{i18n.failed.close}</Link>
      <Button onPress={resetErrorBoundary}>{i18n.failed.retry}</Button>
    </footer>
  </Dialog>
);
