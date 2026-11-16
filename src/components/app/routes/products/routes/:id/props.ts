import { links, settingsOf } from '@/address';

export default ({ route, routes }) => ({
  closeHref: links(settingsOf(route)).href(
    '/products',
    {},
    { category: route.category, order: route.order, page: route.page, q: route.q, sort: route.sort },
  ),
  covered: route.pattern !== '/products/:id',
  id: route.params.id ?? 0,
  removeHref: links(settingsOf(route)).href(
    '/products/:id/remove',
    { id: route.params.id ?? 0 },
    { category: route.category, order: route.order, page: route.page, q: route.q, sort: route.sort },
  ),
  routes,
});
