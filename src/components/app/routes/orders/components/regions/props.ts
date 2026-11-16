export type Props = { region: string; settings: Settings };
// The map's tiles: one per state, with how many orders go there, its place, and the address that
// selects it (selecting the selected state again clears the choice).

import { links, type Settings } from '@/address';
import { byRegion } from '@/services/orders/regions';
import { liveMap } from '@/widgets/live-map';

export default ({
  async: {
    default: { orders, style },
  },
  flags,
  i18n,
  region,
  settings,
}) => {
  const { href } = links(settings);
  const tallies = byRegion(orders);
  return {
    caption: i18n.caption,
    label: i18n.label,
    map: flags.liveMap ? liveMap(style) : undefined,
    max: Math.max(0, ...tallies.map((tally) => tally.orders)),
    tiles: tallies.map((tally) => {
      const current = region === tally.code;
      return {
        code: tally.code,
        count: tally.orders,
        current,
        href: href('/orders', {}, { page: 1, region: current ? '' : tally.code }),
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
  'Nothing selected': {
    props: { region: '', settings: { lang: '', signin: false, skin: 'default', world: 'memory' } },
  },
  'Texas selected': {
    props: { region: 'TX', settings: { lang: '', signin: false, skin: 'default', world: 'memory' } },
  },
};
