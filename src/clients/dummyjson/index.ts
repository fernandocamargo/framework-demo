// DummyJSON, over the network. The session is the browser's, as a backend's cookie would be:
// every tab of the app shares it, and one tab's sign-out ends it in the others.
import { withPermissions } from '../permissions'
import { shared } from '../storage'
import { createHttp } from './http'

// DummyJSON has no permissions endpoint: a layer over the wire answers it as a backend would.
export default ({ env }) => createHttp({ baseUrl: env.apiUrl, wire: withPermissions((url, init) => fetch(url, init)), storage: shared() })
