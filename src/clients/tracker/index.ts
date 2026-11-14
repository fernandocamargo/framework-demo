// A destination for what the framework's pipelines carry: every interaction (a render's `on…`
// handler, a key a shortcuts.ts declares) with the place it was written, every failure with the
// layer that caught it, and what the data layer did. An analytics tool or an error tracker would
// plug in the same way; this one keeps the last few, for the network lab's inspector.
//
// It listens from the moment the app loads, as such a destination must, so what happened before
// the lab first opened is there too. It leaves out the lab's own reading of it.

import { connect, consent, onData, onFailure, type DataEvent, type Failure, type Interaction } from 'framework'

/** One thing the app did, as the pipelines carried it, with the time it was seen. */
export type Tracked = { at: number; event: Interaction | Failure | DataEvent }

let entries: Tracked[] = []
const add = (event: Tracked['event']) => {
  entries = [{ at: Date.now(), event }, ...entries].slice(0, 80)
}
consent.grant('diagnostics')
connect({ name: 'lab', purpose: 'diagnostics', map: (interaction: Interaction) => interaction, send: (batch) => batch.forEach(add) })
onFailure(add)
onData((event) => {
  if (event.path !== 'lab.activity') add(event)
})

export default ({ env: _ }) => ({ recent: (): Tracked[] => entries })
