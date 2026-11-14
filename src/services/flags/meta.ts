// The flags' reads follow the provider: when it says its flags changed (the lab served one another
// way, here or in another tab), they are read again, with every component that read them. So
// serving a flag makes nothing stale itself: the provider's word reaches every tab the same way.
export default ({ clients: { flags } }) => ({
  evaluate: { reads: true, follows: (stale) => flags.changed(stale) },
  served: { reads: true, follows: (stale) => flags.changed(stale) },
})
