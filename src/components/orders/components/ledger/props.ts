// The ledger: the orders of one state (all of them for none), twelve to a page, each with its
// customer, where it ships and what it costs. A customer's name is in full only for a grant to
// read customers; otherwise its first name and initial.
import { format, HOME } from '@/address';
import { CURRENCY } from '@/format';
import { inRegion, REGIONS } from '@/services/orders/regions';

const PER_PAGE = 12;

export default ({ acl, async: { default: answer }, i18n, intl }) => {
  const { orders, page, region } = answer;
  const matching = inRegion(orders, region);
  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const shown = matching.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const name = REGIONS.find((state) => state.code === region)?.name ?? region;
  const full = acl.grants.customers.includes('read');
  const scope = region ? 'some' : 'all';
  const to = (target: number) => format({ ...HOME, page: target, region, section: 'orders' });
  return {
    currency: CURRENCY,
    empty: shown.length === 0,
    emptyText: region ? i18n.empty.region({ name }) : i18n.empty.none,
    i18n,
    orders: shown.map((order) => ({
      city: order.customer.address.city,
      customer: full
        ? `${order.customer.firstName} ${order.customer.lastName}`
        : `${order.customer.firstName} ${order.customer.lastName.charAt(0)}.`,
      href: format({ ...HOME, cart: order.id, page, region, section: 'orders' }),
      id: order.id,
      items: i18n.items({ count: order.items }),
      number: i18n.number({ number: order.id }),
      price: { text: intl.formatNumber(order.total, { currency: CURRENCY, style: 'currency' }), value: order.total },
      region: order.customer.address.region,
    })),
    paging: {
      nextHref: page < pages ? to(page + 1) : null,
      previousHref: page > 1 ? to(page - 1) : null,
      shown: pages > 1,
      text: i18n.paging.page({ page, pages }),
    },
    summary: i18n.summary({ count: matching.length, name, scope }),
  };
};

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'Every order, the second page': { route: { page: 2, section: 'orders' } },
  'Texas, the first page': { route: { page: 1, region: 'TX', section: 'orders' } },
};
