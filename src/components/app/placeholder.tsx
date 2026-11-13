export default ({ className, i18n }) => (
  <div className={className} aria-busy="true">
    <header>
      <div className="brand">
        <span className="mark" aria-hidden="true" />
        <h1>{i18n.brand}</h1>
      </div>
    </header>
    <main>
      <p className="visually-hidden">{i18n.loading}</p>
    </main>
  </div>
)
