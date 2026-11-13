// The same API with no network: the client's own code, on a wire that answers from fixtures.
// Tests and the end-to-end run use it, and so does `?world=memory` in the address. Nothing is
// kept: a reload starts the world over.
import { createHttp } from '../dummyjson/http'
import { memoryStorage } from '../storage'
import { createServer } from './server'

export default ({ env: _ }) => createHttp({ baseUrl: 'http://memory.invalid', wire: createServer(), storage: memoryStorage(), backoff: 20 })
