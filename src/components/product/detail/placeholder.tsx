import { Dialog } from 'react-aria-components';

// Inside the modal the page opened (components/modal), which stays when the product arrives. It
// is already a product, with nothing of it read yet: the modal takes a product's size from here.
export default ({ className, i18n }) => (
  <Dialog aria-busy="true" aria-label={i18n.loading} className={`react-aria-Dialog ${className}`}>
    <article aria-hidden="true" itemScope itemType="https://schema.org/Product">
      <div />
      <div />
      <div />
    </article>
  </Dialog>
);
