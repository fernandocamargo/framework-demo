// The shop's API, as services see it: `clients.api`. This is the one place that decides which
// world the app is in. Both worlds are the same client code (dummyjson/http.ts) on another
// wire, so tokens, retries and the network lab's faults behave the same in each.

import dummyjson from '../dummyjson'
import memory from '../memory'

export default ({ env }) => (env.world === 'memory' ? memory({ env }) : dummyjson({ env }))
