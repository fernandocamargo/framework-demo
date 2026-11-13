// DummyJSON, over the network. The session lasts as long as the tab.
import { withPermissions } from '../permissions'
import { createHttp } from './http'

// DummyJSON has no permissions endpoint: a layer over the wire answers it as a backend would.
export default ({ env }) => createHttp({ baseUrl: env.apiUrl, wire: withPermissions((url, init) => fetch(url, init)), storage: window.sessionStorage })
