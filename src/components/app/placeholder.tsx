export default ({ className }) => (
  <div className={className} aria-busy="true">
    <header>
      <div className="brand">
        <span className="mark" aria-hidden="true" />
        <h1>Stockroom</h1>
      </div>
    </header>
    <main>
      <p className="visually-hidden">Loading the catalogue</p>
    </main>
  </div>
)
