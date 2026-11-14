export default ({ className, i18n }) => (
  <section aria-busy="true" className={className}>
    <div className="top">
      <div>
        <h2>{i18n.title}</h2>
        <p className="summary">{i18n.loading}</p>
      </div>
    </div>
    <ul aria-hidden="true" className="rows">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <li className="skeleton" key={row} style={{ blockSize: '4.6rem' }} />
      ))}
    </ul>
  </section>
);
