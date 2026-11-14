// The map's tiles: one per state, with how many orders go there, its place, and the address that
// selects it (selecting the selected state again clears the choice).
import { format, HOME } from '@/address';
import { byRegion } from '@/services/orders/regions';

export default ({ async: { default: orders }, i18n, route }) => {
  const tallies = byRegion(orders);
  return {
    caption: i18n.caption,
    label: i18n.label,
    max: Math.max(0, ...tallies.map((tally) => tally.orders)),
    tiles: tallies.map((tally) => {
      const current = route.region === tally.code;
      return {
        code: tally.code,
        count: tally.orders,
        current,
        href: format({ ...HOME, region: current ? '' : tally.code, section: 'orders' }),
        label: i18n.tile({ count: tally.orders, name: tally.name }),
        lat: tally.lat,
        lng: tally.lng,
        name: tally.name,
      };
    }),
  };
};

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'Nothing selected': { route: { section: 'orders' } },
  'Texas selected': { route: { region: 'TX', section: 'orders' } },
};
