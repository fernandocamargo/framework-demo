import { Button, Dialog } from 'react-aria-components';

// The order, as schema.org names one: its customer, where it ships and its items, each item a
// product of the catalogue with its quantity.
export default ({ address, className, currency, customer, i18n, lines, title, total }) => (
  <Dialog aria-label={title} className={`react-aria-Dialog ${className}`}>
    <article itemScope itemType="https://schema.org/Order">
      <header>
        <hgroup>
          <h2>
            <span itemProp="orderNumber">{title}</span>
          </h2>
          <p itemProp="customer" itemScope itemType="https://schema.org/Person">
            <span itemProp="name">{customer}</span>
          </p>
        </hgroup>
        <Button slot="close">{i18n.close}</Button>
      </header>
      <div itemProp="orderDelivery" itemScope itemType="https://schema.org/ParcelDelivery">
        <address itemProp="deliveryAddress" itemScope itemType="https://schema.org/PostalAddress">
          {/* The lines of a US address, in its order: the street, then city, state and postal code. The
              spaces keep them apart in a skin that sets them in one line. */}
          {address.full && <span itemProp="streetAddress">{address.street}</span>}{' '}
          <span itemProp="addressLocality">{address.city}</span>, <span itemProp="addressRegion">{address.region}</span>
          {address.full && ' '}
          {address.full && <span itemProp="postalCode">{address.postalCode}</span>}{' '}
          <span itemProp="addressCountry">{address.country}</span>
          {!address.full && <p>{i18n.hidden}</p>}
        </address>
      </div>
      <ol aria-label={i18n.items}>
        {lines.map((line) => (
          <li itemProp="orderedItem" itemScope itemType="https://schema.org/OrderItem" key={line.id}>
            <data itemProp="orderQuantity" value={line.quantity}>
              {i18n.quantity({ quantity: line.quantity })}
            </data>
            <span itemProp="orderedItem" itemScope itemType="https://schema.org/Product">
              <img alt="" itemProp="image" loading="lazy" src={line.thumbnail} />
              <a aria-label={line.title} href={line.href} tabIndex={0}>
                <span itemProp="name">{line.title}</span>
              </a>
            </span>
            <span>{line.total}</span>
          </li>
        ))}
      </ol>
      <p itemProp="acceptedOffer" itemScope itemType="https://schema.org/Offer">
        <span>{i18n.total}</span>{' '}
        <data itemProp="price" value={total.value}>
          {total.text}
        </data>
        <meta content={currency} itemProp="priceCurrency" />
      </p>
    </article>
  </Dialog>
);
