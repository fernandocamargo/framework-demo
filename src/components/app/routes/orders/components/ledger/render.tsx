// The orders, as schema.org names them: each one an order, with its customer, the address it ships
// to, and its price as the offer it was accepted at.
export default ({ className, currency, empty, emptyText, i18n, orders, paging, summary }) => (
  <section aria-label={i18n.label} className={className}>
    <header>
      <p role="status">{summary}</p>
    </header>
    {empty ? (
      <p>{emptyText}</p>
    ) : (
      <ul aria-label={i18n.list}>
        {orders.map((order) => (
          <li itemScope itemType="https://schema.org/Order" key={order.id}>
            <a aria-label={order.number} href={order.href} tabIndex={0}>
              <span itemProp="orderNumber">{order.number}</span>
            </a>
            <span itemProp="customer" itemScope itemType="https://schema.org/Person">
              <span itemProp="name">{order.customer}</span>
            </span>
            <span itemProp="orderDelivery" itemScope itemType="https://schema.org/ParcelDelivery">
              <span itemProp="deliveryAddress" itemScope itemType="https://schema.org/PostalAddress">
                <span itemProp="addressLocality">{order.city}</span>,{' '}
                <span itemProp="addressRegion">{order.region}</span>
              </span>
            </span>
            <span>{order.items}</span>
            <span itemProp="acceptedOffer" itemScope itemType="https://schema.org/Offer">
              <data itemProp="price" value={order.price.value}>
                {order.price.text}
              </data>
              <meta content={currency} itemProp="priceCurrency" />
            </span>
          </li>
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
