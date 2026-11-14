// While the flags are read: the tab alone waits, and the lab around it stays as it is.
export default ({ className, i18n }) => (
  <section aria-busy="true" aria-label={i18n.label} className={className}>
    <div className="skeleton" style={{ blockSize: '2.4rem' }} />
    <div className="skeleton" style={{ blockSize: '3.6rem' }} />
    <div className="skeleton" style={{ blockSize: '3.6rem' }} />
  </section>
);
