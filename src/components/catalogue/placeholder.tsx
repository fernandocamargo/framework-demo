export default ({ className, i18n }) => (
  <section className={className} aria-busy="true">
    <div className="top">
      <div>
        <h2>{i18n.title}</h2>
        <p className="summary">{i18n.loading}</p>
      </div>
    </div>
    <ul className="rows" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <li key={row} className="skeleton" style={{ blockSize: '4.6rem' }} />
      ))}
    </ul>
  </section>
)
