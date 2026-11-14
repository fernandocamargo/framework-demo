import { Dialog } from 'react-aria-components';

// Inside the modal the page opened (components/modal), which stays when the product arrives.
export default ({ className, i18n }) => (
  <Dialog aria-busy="true" aria-label={i18n.loading} className={`react-aria-Dialog ${className}`}>
    <div className="skeleton" style={{ blockSize: '1.6rem', inlineSize: '60%' }} />
    <div className="skeleton" style={{ blockSize: '9rem' }} />
    <div className="skeleton" style={{ blockSize: '3rem' }} />
  </Dialog>
);
