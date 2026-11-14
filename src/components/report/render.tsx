import { Link } from 'react-aria-components';

// The report, as schema.org names one: its headline and abstract say what it finds, its figures
// follow, and the table names each category as one of its mentions, an aggregate offer. The ten
// products closest to running out are mentions too, each with its offer.
export default ({ asOf, className, dated, deck, figures, headline, i18n, rows, shortest }) => (
  <article aria-labelledby="report-headline" className={className} itemScope itemType="https://schema.org/Report">
    <header>
      <hgroup>
        <h2 id="report-headline" itemProp="headline">
          {headline}
        </h2>
        <p itemProp="abstract">{deck}</p>
      </hgroup>
      <time dateTime={asOf} itemProp="dateCreated">
        {dated}
      </time>
    </header>
    <dl>
      {figures.map((figure) => (
        <div key={figure.key}>
          <dt>{figure.label}</dt>
          <dd>
            <data value={figure.value}>{figure.text}</data>
          </dd>
        </div>
      ))}
    </dl>
    <table>
      <caption>{i18n.table.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{i18n.table.category}</th>
          <th scope="col">{i18n.table.offers}</th>
          <th scope="col">{i18n.table.units}</th>
          <th scope="col">{i18n.table.value}</th>
          <th scope="col">{i18n.table.prices}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr itemProp="mentions" itemScope itemType="https://schema.org/AggregateOffer" key={row.key}>
            <th scope="row">
              <Link href={row.href}>
                <span itemProp="category">{row.name}</span>
              </Link>
            </th>
            <td>
              <data itemProp="offerCount" value={row.offers.value}>
                {row.offers.text}
              </data>
            </td>
            <td>
              <data itemProp="inventoryLevel" value={row.units.value}>
                {row.units.text}
              </data>{' '}
              <meter max={row.meter.max} min={0} value={row.meter.value}>
                {row.units.text}
              </meter>
            </td>
            <td>{row.value}</td>
            <td>
              <data itemProp="lowPrice" value={row.lowPrice.value}>
                {row.lowPrice.text}
              </data>
              {' – '}
              <data itemProp="highPrice" value={row.highPrice.value}>
                {row.highPrice.text}
              </data>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <section aria-labelledby="report-shortest">
      <h3 id="report-shortest">{i18n.shortest.title}</h3>
      <ul aria-label={i18n.shortest.label}>
        {shortest.map((product) => (
          <li itemProp="mentions" itemScope itemType="https://schema.org/Product" key={product.id}>
            <Link href={product.href}>
              <span itemProp="name">{product.title}</span>
            </Link>
            <div itemProp="offers" itemScope itemType="https://schema.org/Offer">
              <link href={product.availability} itemProp="availability" />
              <data itemProp="inventoryLevel" value={product.stock}>
                {product.label}
              </data>
            </div>
          </li>
        ))}
      </ul>
    </section>
  </article>
);
