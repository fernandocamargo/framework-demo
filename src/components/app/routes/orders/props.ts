// The orders page: whether its map and ledger may show, and what a guest is offered instead.
import { links } from '@/address';

export default ({ acl, i18n, route, routes }) => {
  // Only the guest's sign-in link asks for the session dialog.
  const settings = { lang: route.lang, signin: false, skin: route.skin, world: route.world };
  const { href } = links(settings);

  return {
    allowed: acl.allowed,
    guest: acl.role === 'guest',
    i18n,
    page: route.page,
    region: route.region,
    routes,
    settings,
    signInHref: href('/orders', {}, { signin: true }),
  };
};

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'The orders, read by a moderator': { route: { pattern: '/orders' } },
};
