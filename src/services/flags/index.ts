// The feature flags, as the app's flows read them. The client holds the provider; Root's `flags`
// read evaluates them for the person signed in, and every component that reads `flags` gets them.
import type { Name, Served, Targeting } from '@/clients/flags/definitions'

/** The flags this person gets: by id, and by the role the backend gives them. */
export const evaluate =
  ({ clients: { flags } }) =>
  async (who: Targeting) =>
    flags.evaluate(who)

/** How each flag is served, for the network lab. */
export const served =
  ({ clients: { flags } }) =>
  async () =>
    flags.lab.served()

/** Serves a flag another way, as GrowthBook's dashboard would. */
export const serve =
  ({ clients: { flags } }) =>
  async <Flag extends Name>({ name, way }: { name: Flag; way: Served[Flag] }) =>
    flags.lab.serve(name, way)
