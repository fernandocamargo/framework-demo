// While the orders are read: the ledger's rows, as shapes.
export default ({ className, i18n }) => (
  <section aria-busy="true" aria-label={i18n.label} className={className}>
    <header>
      <p>{i18n.loading}</p>
    </header>
    <ul aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <li key={row} />
      ))}
    </ul>
  </section>
);
