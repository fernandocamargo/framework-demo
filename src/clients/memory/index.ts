// The same API with no network: the client's own code, on a wire that answers from fixtures.
// Tests and the end-to-end run use it, and so does `?world=memory` in the address. The session
// and the local changes are kept as the real world keeps them, in the browser's localStorage
// (under `memory:`), so every tab of the memory world shares them; a new browser starts over.
import { createHttp } from '../dummyjson/http'
import { prefixed } from '../storage'
import { createServer } from './server'

export default ({ env: _ }) => createHttp({ baseUrl: 'http://memory.invalid', wire: createServer(), storage: prefixed(window.localStorage, 'memory:'), backoff: 20 })
