// The product's key opens its editor, for someone who may change it.

import { go } from '@/address'

export default ({ i18n, acl, async: { default: product } }) => ({
  e: { label: i18n.keys.edit, run: () => go({ view: null, edit: product.id }), when: acl.allowed },
})
