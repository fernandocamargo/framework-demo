import { settingsOf } from '@/address';

export default ({ route, routes }) => ({
  filters: { category: route.category, order: route.order, page: route.page, q: route.q, sort: route.sort },
  routes,
  settings: settingsOf(route),
});
