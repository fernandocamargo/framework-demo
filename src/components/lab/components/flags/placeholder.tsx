// While the flags are read: the tab alone waits, and the lab around it stays as it is.
export default ({ className, i18n }) => (
  <section aria-busy="true" aria-label={i18n.label} className={className}>
    <div aria-hidden="true" />
    <div aria-hidden="true" />
    <div aria-hidden="true" />
  </section>
);
