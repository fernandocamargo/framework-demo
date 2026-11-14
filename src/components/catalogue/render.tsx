import { Link } from 'react-aria-components';

import Filters from './components/filters';
import ProductRow from './components/product-row';

export default ({
  bulkHref,
  canChange,
  categories,
  className,
  clearHref,
  createHref,
  empty,
  emptyText,
  filters,
  i18n,
  items,
  paging,
  summary,
}) => (
  <section aria-labelledby="catalogue-title" className={className}>
    <div className="top">
      <div>
        <h2 id="catalogue-title">{i18n.title}</h2>
        <p className="summary" role="status">
          {summary}
        </p>
      </div>
      {canChange && (
        <div className="actions">
          <Link data-variant="secondary" href={bulkHref}>
            <span className="icon" data-icon="tag" />
            {i18n.actions.bulk}
          </Link>
          <Link data-variant="primary" href={createHref}>
            <span className="icon" data-icon="plus" />
            {i18n.actions.create}
          </Link>
        </div>
      )}
    </div>
    {!canChange && (
      <p className="notice" data-tone="info" role="note">
        <span className="icon" data-icon="user" />
        {i18n.readOnly}
      </p>
    )}
    <Filters
      categories={categories}
      category={filters.category}
      order={filters.order}
      q={filters.q}
      sort={filters.sort}
    />
    {empty ? (
      <div className="empty">
        <p>{emptyText}</p>
        {clearHref && <Link href={clearHref}>{i18n.empty.clear}</Link>}
      </div>
    ) : (
      <ul aria-label={i18n.list} className="rows">
        {items.map((product) => (
          <ProductRow filters={filters} key={product.id} product={product} />
        ))}
      </ul>
    )}
    {paging.shown && (
      <nav aria-label={i18n.paging.label} className="paging">
        <Link data-variant="secondary" href={paging.previousHref ?? undefined} isDisabled={!paging.previousHref}>
          {i18n.paging.previous}
        </Link>
        <span>{paging.text}</span>
        <Link data-variant="secondary" href={paging.nextHref ?? undefined} isDisabled={!paging.nextHref}>
          {i18n.paging.next}
        </Link>
      </nav>
    )}
  </section>
);
