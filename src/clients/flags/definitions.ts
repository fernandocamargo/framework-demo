// The app's feature flags, as the GrowthBook project will hold them. Until its client key arrives,
// OpenFeature's in-memory provider serves these same flags (index.ts), so nothing else changes
// when it does: the provider is the one line that changes.
//
// Each flag has its values, the value the app falls back on when the provider cannot answer, and
// the ways it can be served: who gets which value. One way is served at a time; the network lab
// chooses another, as GrowthBook's dashboard would.
import type { Acl, Flags } from 'framework'

/** Who is asking, as the provider targets them: by id, and by the role the backend gives them. */
export type Targeting = { targetingKey: string; role: Acl['role'] }

type Definition<Value> = {
  /** The flag's key at the provider. */
  key: string
  variants: Record<string, Value>
  fallback: Value
  /** Each way the flag can be served: the variant each person gets. */
  ways: Record<string, (who: Targeting) => string>
  /** The way served until the lab chooses another. */
  served: string
}

export const definitions = {
  // Counting stock from the catalogue's rows, with − and +: rolled out to admins first.
  stockCount: {
    key: 'stock-count',
    variants: { on: true, off: false },
    fallback: false,
    ways: { admins: ({ role }) => (role === 'admin' ? 'on' : 'off'), everyone: () => 'on', nobody: () => 'off' },
    served: 'admins',
  },
  // Whether products may be deleted. Off pauses every deletion: a kill switch.
  deletions: {
    key: 'deletions',
    variants: { on: true, off: false },
    fallback: true,
    ways: { on: () => 'on', off: () => 'off' },
    served: 'on',
  },
  // Above which percentage a bulk price change asks a second time: sooner for moderators.
  largeChangeAt: {
    key: 'large-change-at',
    variants: { soon: 10, usual: 50 },
    fallback: 50,
    ways: { moderators: ({ role }) => (role === 'moderator' ? 'soon' : 'usual'), usual: () => 'usual', soon: () => 'soon' },
    served: 'moderators',
  },
} satisfies { [Name in keyof Flags]: Definition<Flags[Name]> }

export type Name = keyof typeof definitions
/** The way each flag is served. */
export type Served = { [Name in keyof typeof definitions]: keyof (typeof definitions)[Name]['ways'] & string }

export const names = Object.keys(definitions) as Name[]
