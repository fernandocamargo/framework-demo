import { Link } from 'react-aria-components'

export default ({ className, i18n, charts }) => (
  <main className={className} aria-labelledby="states-title">
    <header>
      <Link href="#/products">{i18n.back}</Link>
      <h1 id="states-title">{i18n.title}</h1>
      <p>{i18n.intro}</p>
    </header>
    {charts.map((chart) => (
      <section key={chart.path} aria-label={chart.path}>
        <h2>
          <code>{chart.file}</code> <small>{chart.count}</small>
        </h2>
        {chart.description && <p>{chart.description}</p>}
        <ul className="frames">
          {chart.states.map((state) => (
            <li key={state.path}>
              <figure>
                <div className="frame">
                  <iframe src={state.src} title={state.title} loading="lazy" tabIndex={-1} />
                </div>
                <figcaption>
                  <strong>{state.path}</strong>
                  {state.example && <span className="badge">{state.example}</span>}
                  {state.description && <span>{state.description}</span>}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </main>
)
