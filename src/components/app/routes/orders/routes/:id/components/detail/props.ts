// The order's dialog: its lines, each a product of the catalogue, its customer and where it ships.
// The street and the postal code are for a grant to read customers; anyone else is shown the city
// and the state, with a note that the rest is hidden. The customer's name follows the ledger's rule.
import { HOME, links } from '@/address';
import { CURRENCY } from '@/format';

export default ({ acl, async: { default: order }, i18n, intl, route }) => {
  const { href } = links(route);
  const full = acl.grants.customers.includes('read');
  const { address, firstName, lastName } = order.customer;
  const price = (value: number) => intl.formatNumber(value, { currency: CURRENCY, style: 'currency' });
  return {
    address: {
      city: address.city,
      country: address.country,
      full,
      postalCode: full ? address.postalCode : '',
      region: address.region,
      street: full ? address.street : '',
    },
    currency: CURRENCY,
    customer: full ? `${firstName} ${lastName}` : `${firstName} ${lastName.charAt(0)}.`,
    i18n,
    lines: order.lines.map((line) => ({
      href: href('/products/:id', { id: line.id }, HOME),
      id: line.id,
      quantity: line.quantity,
      thumbnail: line.thumbnail,
      title: line.title,
      total: price(line.total),
    })),
    title: i18n.title({ number: order.id }),
    total: { text: price(order.total), value: order.total },
  };
};

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'An order, read by a moderator': { route: { params: { id: 1 }, pattern: '/orders/:id' } },
  'An order, read by an admin': { route: { params: { id: 24 }, pattern: '/orders/:id' } },
};
