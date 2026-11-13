export default ({ className }) => (
  <section className={className} aria-busy="true">
    <div className="top">
      <div>
        <h2>Products</h2>
        <p className="summary">Reading the catalogue…</p>
      </div>
    </div>
    <ul className="rows" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <li key={row} className="skeleton" style={{ blockSize: '4.6rem' }} />
      ))}
    </ul>
  </section>
)
