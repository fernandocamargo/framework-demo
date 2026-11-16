import Filters from './components/filters';
import ProductRow from './components/product-row';

// The catalogue, as schema.org names one: a list of offers, each row one of its elements, with
// what may be done to it as its potential actions.
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
  total,
}) => (
  <section aria-labelledby="catalogue-title" className={className} itemScope itemType="https://schema.org/OfferCatalog">
    <header>
      <hgroup>
        <h2 id="catalogue-title" itemProp="name">
          {i18n.title}
        </h2>
        <p role="status">
          {summary((chunks) => (
            <data itemProp="numberOfItems" value={total}>
              {chunks}
            </data>
          ))}
        </p>
      </hgroup>
      {canChange && (
        <menu>
          <li>
            <a aria-label={i18n.actions.bulk} href={bulkHref} tabIndex={0}>
              <span itemProp="potentialAction" itemScope itemType="https://schema.org/ReplaceAction">
                <span itemProp="name">{i18n.actions.bulk}</span>
              </span>
            </a>
          </li>
          <li>
            <a aria-label={i18n.actions.create} href={createHref} tabIndex={0}>
              <span itemProp="potentialAction" itemScope itemType="https://schema.org/CreateAction">
                <span itemProp="name">{i18n.actions.create}</span>
              </span>
            </a>
          </li>
        </menu>
      )}
    </header>
    {!canChange && <p role="note">{i18n.readOnly}</p>}
    <Filters
      categories={categories}
      category={filters.category}
      order={filters.order}
      q={filters.q}
      sort={filters.sort}
    />
    {empty ? (
      <p>
        {emptyText}
        {clearHref && (
          <a href={clearHref} tabIndex={0}>
            {i18n.empty.clear}
          </a>
        )}
      </p>
    ) : (
      <ul aria-label={i18n.list}>
        {items.map((item) => (
          <ProductRow
            editHref={item.editHref}
            key={item.product.id}
            product={item.product}
            removeHref={item.removeHref}
            viewHref={item.viewHref}
          />
        ))}
      </ul>
    )}
    {paging.shown && (
      <nav aria-label={i18n.paging.label}>
        {/* An anchor without a destination keeps focus when paging reaches an end. */}
        <a
          aria-disabled={!paging.previousHref || undefined}
          href={paging.previousHref ?? undefined}
          role="link"
          tabIndex={0}
        >
          {i18n.paging.previous}
        </a>
        <span>{paging.text}</span>
        <a aria-disabled={!paging.nextHref || undefined} href={paging.nextHref ?? undefined} role="link" tabIndex={0}>
          {i18n.paging.next}
        </a>
      </nav>
    )}
  </section>
);
