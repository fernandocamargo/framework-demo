// The catalogue's keys. Creating and the bulk change follow what the person may do, as the links
// do; paging follows the page the catalogue read. A key that does nothing now is still listed,
// as unavailable.

import { go } from '@/address';

export default ({ acl, async: { default: answer }, i18n }) => ({
  '/': { focus: 'input[type=search]', label: i18n.keys.search },
  n: { label: i18n.keys.create, run: () => go({ create: true }), when: acl.allowed },
  b: { label: i18n.keys.bulk, run: () => go({ bulk: true }), when: acl.allowed },
  '[': { label: i18n.keys.previous, run: () => go({ page: answer.page.page - 1 }), when: answer.page.page > 1 },
  ']': {
    label: i18n.keys.next,
    run: () => go({ page: answer.page.page + 1 }),
    when: answer.page.page < answer.page.pages,
  },
});
