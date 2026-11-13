import { Link } from 'react-aria-components'
import Filters from './components/filters'
import ProductRow from './components/product-row'

export default ({ className, filters, categories, items, summary, empty, emptyText, clearHref, createHref, bulkHref, paging }) => (
  <section className={className} aria-labelledby="catalogue-title">
    <div className="top">
      <div>
        <h2 id="catalogue-title">Products</h2>
        <p className="summary" role="status">
          {summary}
        </p>
      </div>
      <div className="actions">
        <Link href={bulkHref} data-variant="secondary">
          <span className="icon" data-icon="tag" />
          Bulk price change
        </Link>
        <Link href={createHref} data-variant="primary">
          <span className="icon" data-icon="plus" />
          New product
        </Link>
      </div>
    </div>
    <Filters filters={filters} categories={categories} />
    {empty ? (
      <div className="empty">
        <p>{emptyText}</p>
        {clearHref && <Link href={clearHref}>Clear the filters</Link>}
      </div>
    ) : (
      <ul className="rows" aria-label="Products">
        {items.map((product) => (
          <ProductRow key={product.id} product={product} filters={filters} />
        ))}
      </ul>
    )}
    {paging.shown && (
      <nav className="paging" aria-label="Pages">
        <Link href={paging.previousHref ?? undefined} isDisabled={!paging.previousHref} data-variant="secondary">
          Previous
        </Link>
        <span>{paging.text}</span>
        <Link href={paging.nextHref ?? undefined} isDisabled={!paging.nextHref} data-variant="secondary">
          Next
        </Link>
      </nav>
    )}
  </section>
)
