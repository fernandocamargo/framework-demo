import { Dialog } from 'react-aria-components';

// Inside the modal the page opened (components/modal), which stays when the product arrives. It
// is already a product, with nothing of it read yet: the modal takes a product's size from here.
export default ({ className, i18n }) => (
  <Dialog aria-label={i18n.loading} className={`react-aria-Dialog ${className}`}>
    <article aria-busy="true" aria-label={i18n.loading} itemScope itemType="https://schema.org/Product">
      <div aria-hidden="true" />
      <div aria-hidden="true" />
      <div aria-hidden="true" />
    </article>
  </Dialog>
);
