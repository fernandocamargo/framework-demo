export default ({ className, i18n }) => (
  <div aria-busy="true" className={className}>
    <header>
      <div className="brand">
        <span aria-hidden="true" className="mark" />
        <h1>{i18n.brand}</h1>
      </div>
    </header>
    <main>
      <p className="visually-hidden">{i18n.loading}</p>
    </main>
  </div>
);
