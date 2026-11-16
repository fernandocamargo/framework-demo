import type { Env } from 'framework';

import { codec } from '../address';
import { fromLegacy } from '../legacy';

// Read a legacy bookmark as its destination before the shell replaces the address.
const first = new URL(fromLegacy(window.location) ?? window.location.href, window.location.href);
const initial = codec.read(first.pathname.slice(codec.base.length - 1), first.search);

const world: Env['world'] =
  initial.query['world'] === 'memory' || import.meta.env['VITE_WORLD'] === 'memory' ? 'memory' : 'dummyjson';

// GrowthBook serves the real world's flags when its client key is in the build (.env.local).
const env: Env = {
  apiUrl: 'https://dummyjson.com',
  flagsKey: import.meta.env['VITE_GROWTHBOOK_CLIENT_KEY'],
  mapsKey: import.meta.env['VITE_MAPTILER_KEY'],
  world,
};

export default env;
