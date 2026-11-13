import { Link } from 'react-aria-components'
import Filters from './components/filters'
import ProductRow from './components/product-row'

export default ({ className, i18n, filters, categories, items, summary, empty, emptyText, clearHref, createHref, bulkHref, paging }) => (
  <section className={className} aria-labelledby="catalogue-title">
    <div className="top">
      <div>
        <h2 id="catalogue-title">{i18n.title}</h2>
        <p className="summary" role="status">
          {summary}
        </p>
      </div>
      <div className="actions">
        <Link href={bulkHref} data-variant="secondary">
          <span className="icon" data-icon="tag" />
          {i18n.actions.bulk}
        </Link>
        <Link href={createHref} data-variant="primary">
          <span className="icon" data-icon="plus" />
          {i18n.actions.create}
        </Link>
      </div>
    </div>
    <Filters filters={filters} categories={categories} />
    {empty ? (
      <div className="empty">
        <p>{emptyText}</p>
        {clearHref && <Link href={clearHref}>{i18n.empty.clear}</Link>}
      </div>
    ) : (
      <ul className="rows" aria-label={i18n.list}>
        {items.map((product) => (
          <ProductRow key={product.id} product={product} filters={filters} />
        ))}
      </ul>
    )}
    {paging.shown && (
      <nav className="paging" aria-label={i18n.paging.label}>
        <Link href={paging.previousHref ?? undefined} isDisabled={!paging.previousHref} data-variant="secondary">
          {i18n.paging.previous}
        </Link>
        <span>{paging.text}</span>
        <Link href={paging.nextHref ?? undefined} isDisabled={!paging.nextHref} data-variant="secondary">
          {i18n.paging.next}
        </Link>
      </nav>
    )}
  </section>
)
