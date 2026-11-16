// The product's key opens its editor, for someone who may change it.

import { go } from '@/address';

export default ({ acl, async: { default: product }, i18n }) => ({
  e: { label: i18n.keys.edit, run: () => go('/products/:id/edit', { id: product.id }), when: acl.allowed },
});
