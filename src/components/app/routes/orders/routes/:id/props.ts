import { links, settingsOf } from '@/address';
// The address cannot bypass the backend's grant to read an order.

export default ({ acl, route }) => ({
  allowed: acl.grants.orders.includes('read'),
  closeHref: links(route).href('/orders', {}, { page: route.page, region: route.region }),
  id: route.params.id ?? 0,
  settings: settingsOf(route),
});
