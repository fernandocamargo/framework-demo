import { Button, Dialog, Heading } from 'react-aria-components';

import { go } from '@/address';

// Inside the modal the page opened (components/modal), in place of the product.
export default ({ className, error, i18n, resetErrorBoundary }) => (
  <Dialog className={`react-aria-Dialog ${className}`} role="alertdialog">
    <Heading slot="title">{i18n.failed.title}</Heading>
    <p>{error.message}</p>
    <footer>
      <Button onPress={() => go({ view: null })}>{i18n.failed.close}</Button>
      <Button data-variant="primary" onPress={resetErrorBoundary}>
        {i18n.failed.retry}
      </Button>
    </footer>
  </Dialog>
);
