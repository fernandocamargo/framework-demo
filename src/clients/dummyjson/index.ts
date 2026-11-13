// DummyJSON, over the network. The session lasts as long as the tab.
import { createHttp } from './http'

export default ({ env }) => createHttp({ baseUrl: env.apiUrl, wire: (url, init) => fetch(url, init), storage: window.sessionStorage })
