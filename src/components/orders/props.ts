// The orders page: whether its map and ledger may show, and what a guest is offered instead.
import { format, HOME } from '@/address';

export default ({ acl, i18n }) => ({
  allowed: acl.allowed,
  guest: acl.role === 'guest',
  i18n,
  signInHref: format({ ...HOME, section: 'orders', signin: true }),
});

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'The orders, read by a moderator': { route: { section: 'orders' } },
};
