export default ({ className, i18n }) => (
  <section className={className} aria-busy="true" aria-label={i18n.label}>
    <h3>{i18n.loading}</h3>
    <div className="skeleton" style={{ blockSize: '3.5rem' }} />
  </section>
)
