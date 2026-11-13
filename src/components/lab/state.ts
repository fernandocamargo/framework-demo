// The network lab's panel: closed, or open and reading the latest activity once a second.
import type { Entry } from '@/clients/dummyjson/http'
import type { Tracked } from '@/clients/tracker'

export const description = 'Show the network lab, and keep its activity lists current while it is open.'

export const context = () => ({ network: [] as Entry[], tracked: [] as Tracked[] })

export const remember = ({ event }) => ({ network: event.output.network, tracked: event.output.tracked })

export default ({ services }) => ({
  closed: {
    on: { toggle: 'open' },
  },
  open: {
    invoke: { src: services.lab.activity, onDone: { actions: remember } },
    after: { 1000: { target: 'open', reenter: true } },
    on: { toggle: 'closed' },
  },
})
