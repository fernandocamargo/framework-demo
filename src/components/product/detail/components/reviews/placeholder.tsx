export default ({ className }) => (
  <section className={className} aria-busy="true" aria-label="Reviews">
    <h3>Reading the reviews…</h3>
    <div className="skeleton" style={{ blockSize: '3.5rem' }} />
  </section>
)
