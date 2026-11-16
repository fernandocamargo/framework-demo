import { Link } from 'react-aria-components';

import Ledger from './components/ledger';
import Regions from './components/regions';

// The orders page, as schema.org names one: a collection, a map of the states on top and the ledger
// of their orders under it. Someone who may not read orders is told so, and sees neither. An order
// opens over the page, as the route below this one.
export default ({ allowed, className, guest, i18n, page, region, routes, settings, signInHref }) => (
  <>
    <section
      aria-labelledby="orders-title"
      className={className}
      itemScope
      itemType="https://schema.org/CollectionPage"
    >
      <header>
        <hgroup>
          <h2 id="orders-title" itemProp="name">
            {i18n.title}
          </h2>
        </hgroup>
      </header>
      {allowed ? (
        <>
          <Regions region={region} settings={settings} />
          <Ledger page={page} region={region} settings={settings} />
        </>
      ) : (
        <p role="note">
          {guest ? i18n.guest.note : i18n.restricted}
          {guest && (
            <>
              {' '}
              <Link href={signInHref}>{i18n.guest.signIn}</Link>
            </>
          )}
        </p>
      )}
    </section>
    {routes}
  </>
);
