export default ({ className, i18n }) => (
  <section aria-busy="true" aria-label={i18n.label} className={className}>
    <h3>{i18n.loading}</h3>
    <div aria-hidden="true" />
  </section>
);
