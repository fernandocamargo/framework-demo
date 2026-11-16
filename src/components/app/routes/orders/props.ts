// The orders page: whether its map and ledger may show, and what a guest is offered instead.
import { links, settingsOf } from '@/address';

export default ({ acl, i18n, route, routes }) => {
  const { href } = links(route);
  return {
    allowed: acl.allowed,
    guest: acl.role === 'guest',
    i18n,
    page: route.page,
    region: route.region,
    routes,
    settings: settingsOf(route),
    signInHref: href('/orders', {}, { signin: true }),
  };
};

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'The orders, read by a moderator': { route: { pattern: '/orders' } },
};
