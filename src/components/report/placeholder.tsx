export default ({ className, i18n }) => (
  <section aria-busy="true" className={className}>
    <header>
      <hgroup>
        <h2>{i18n.title}</h2>
        <p>{i18n.loading}</p>
      </hgroup>
    </header>
    <ul aria-hidden="true">
      {[0, 1, 2, 3, 4].map((row) => (
        <li key={row} />
      ))}
    </ul>
  </section>
);
