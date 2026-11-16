import { Button, Dialog, Heading, Link } from 'react-aria-components';

// Inside the modal the page opened (components/modal), in place of the product.
export default ({ className, closeHref, error, i18n, resetErrorBoundary }) => (
  <Dialog className={`react-aria-Dialog ${className}`} role="alertdialog">
    <Heading slot="title">{i18n.failed.title}</Heading>
    <p>{error.message}</p>
    <footer>
      <Link href={closeHref}>{i18n.failed.close}</Link>
      <Button onPress={resetErrorBoundary}>{i18n.failed.retry}</Button>
    </footer>
  </Dialog>
);
