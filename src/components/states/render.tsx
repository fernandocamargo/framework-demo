import { Link } from 'react-aria-components';

export default ({ charts, className, i18n }) => (
  <main aria-labelledby="states-title" className={className}>
    <header>
      <Link href="#/products">{i18n.back}</Link>
      <h1 id="states-title">{i18n.title}</h1>
      <p>{i18n.intro}</p>
    </header>
    {charts.map((chart) => (
      <section aria-label={chart.path} key={chart.path}>
        <h2>
          <code>{chart.file}</code> <small>{chart.count}</small>
        </h2>
        {chart.description && <p>{chart.description}</p>}
        <ul className="frames">
          {chart.states.map((state) => (
            <li key={state.path}>
              <figure>
                <div className="frame">
                  <iframe loading="lazy" src={state.src} tabIndex={-1} title={state.title} />
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
);
