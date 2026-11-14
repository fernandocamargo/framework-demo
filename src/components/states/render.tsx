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
        <ul>
          {chart.states.map((state) => (
            <li key={state.path}>
              {/* Each frame is a page of the app, held in one state, as schema.org names a page. */}
              <figure itemScope itemType="https://schema.org/WebPage">
                <div>
                  <iframe itemProp="url" loading="lazy" src={state.src} tabIndex={-1} title={state.title} />
                </div>
                <figcaption>
                  <strong itemProp="name">{state.path}</strong>
                  {state.example && <small itemProp="isBasedOn">{state.example}</small>}
                  {state.description && <span itemProp="description">{state.description}</span>}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </main>
);
