import { Dialog } from 'react-aria-components';

// Inside the modal the page opened (components/modal), which stays when the order arrives: an order's
// dialog takes its size from here, as the product's does.
export default ({ className, i18n }) => (
  <Dialog aria-busy="true" aria-label={i18n.loading} className={`react-aria-Dialog ${className}`}>
    <article aria-hidden="true" itemScope itemType="https://schema.org/Order">
      <div />
      <div />
      <div />
    </article>
  </Dialog>
);
