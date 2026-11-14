// How each flag is served, read from the flags' client as GrowthBook's dashboard would show it, and
// serving one another way. The read follows the provider (services/flags/meta.ts), so a change made
// here or in another tab shows at once.

import type { Name, Served } from '@/clients/flags/definitions';

export default async ({ services }) => services.flags.served();

export const serve =
  ({ services }) =>
  <Flag extends Name>(name: Flag, way: Served[Flag]) =>
    services.flags.serve({ name, way });
