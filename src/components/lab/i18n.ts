// The network lab's words, in English. Translations: i18n/<locale>.json.
export default {
  title: 'Network lab',
  toggle: '{faults, plural, =0 {Network lab} one {Network lab, # fault on} other {Network lab, # faults on}}',
  close: 'Close the network lab',
  intro: "These change the API client's settings while the app runs. Nothing else in the app knows.",
  latency: { label: 'Latency', value: '{ms, number} ms' },
  failures: { label: 'Requests that fail', value: '{percent, number}%' },
  force: { label: 'Every request answers', ok: 'As it should' },
  token: { label: 'Access token lifetime, from the next sign-in or refresh', minutes: '{minutes, number} min' },
  offline: 'Offline',
  actions: {
    expire: 'Expire the access token',
    revoke: 'Revoke the refresh token',
    sellOut: 'Sell out the product being edited',
    forget: 'Forget local changes',
  },
  tabs: { label: 'Activity', network: 'API client', tracked: 'Interactions and failures' },
  network: { label: "The API client's latest requests", none: 'No request yet.' },
  tracked: { label: 'The latest interactions and failures', none: 'Nothing yet. Every handler in a render is tracked with the place it was written.' },
  kinds: { request: 'request', retry: 'retry', refresh: 'refresh', fault: 'fault', failed: 'failed', interaction: 'interaction', failure: 'failure' },
}
