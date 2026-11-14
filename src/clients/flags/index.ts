// The feature flags, through OpenFeature. Until the GrowthBook client key arrives, the in-memory
// provider serves the flags of definitions.ts; with the key, GrowthBook's provider takes its place
// here, and nothing else changes.
//
// The way each flag is served is kept as GrowthBook's dashboard would keep it: one place every tab
// of the world reads (localStorage). A change made in one tab reaches the others' providers, as
// each tab hears GrowthBook's stream, and each provider says its flags changed.
import { InMemoryProvider, OpenFeature, ProviderEvents } from '@openfeature/web-sdk'
import type { Flags } from 'framework'
import { prefixed } from '../storage'
import { definitions, names, type Name, type Served, type Targeting } from './definitions'

const KEY = 'flags'

const defaults = Object.fromEntries(names.map((name) => [name, definitions[name].served])) as Served

/** The provider's configuration: each flag's variants, and the way served chooses one for whoever asks. */
const configuration = (served: Served) =>
  Object.fromEntries(
    names.map((name) => {
      const { key, variants, ways } = definitions[name]
      const way = (ways as Record<string, (who: Targeting) => string>)[served[name]] ?? (ways as Record<string, (who: Targeting) => string>)[definitions[name].served]!
      const anyone: Targeting = { targetingKey: 'guest', role: 'guest' }
      return [key, { variants, defaultVariant: way(anyone), disabled: false, contextEvaluator: (context: object) => way(context as Targeting) }]
    }),
  )

export default ({ env }) => {
  const storage = env.world === 'memory' ? prefixed(window.localStorage, 'memory:') : window.localStorage
  const stored = (): Served => {
    try {
      const kept = JSON.parse(storage.getItem(KEY) ?? '{}') as Partial<Record<Name, string>>
      // Only ways the flags still have: a way removed since is served as the default again.
      return Object.fromEntries(names.map((name) => [name, kept[name] && kept[name] in definitions[name].ways ? kept[name] : defaults[name]])) as Served
    } catch {
      return defaults
    }
  }
  const provider = new InMemoryProvider(configuration(stored()))
  void OpenFeature.setProviderAndWait(provider)
  const client = OpenFeature.getClient()
  // Another tab served a flag another way: this tab's provider takes it.
  window.addEventListener('storage', (event) => {
    if (event.key === `${env.world === 'memory' ? 'memory:' : ''}${KEY}`) void provider.putConfiguration(configuration(stored()))
  })
  const value = (name: Name) => {
    const { key, fallback } = definitions[name]
    return typeof fallback === 'boolean' ? client.getBooleanValue(key, fallback) : client.getNumberValue(key, fallback)
  }
  return {
    /** The flags this person gets, as the provider serves them. OpenFeature's web SDK keeps one person at a time. */
    async evaluate(who: Targeting): Promise<Flags> {
      await OpenFeature.setContext(who)
      return Object.fromEntries(names.map((name) => [name, value(name)])) as unknown as Flags
    },
    /** Calls `listener` whenever the provider's flags change; returns what stops it. */
    changed(listener: () => void) {
      client.addHandler(ProviderEvents.ConfigurationChanged, listener)
      return () => client.removeHandler(ProviderEvents.ConfigurationChanged, listener)
    },
    /** The dashboard's side, for the network lab: how each flag is served, and serving one another way. */
    lab: {
      served: stored,
      async serve<Flag extends Name>(name: Flag, way: Served[Flag]) {
        const next = { ...stored(), [name]: way }
        storage.setItem(KEY, JSON.stringify(next))
        await provider.putConfiguration(configuration(next))
      },
    },
  }
}
