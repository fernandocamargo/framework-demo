// The network lab's words, in English. Translations: i18n/<locale>.json.
export default {
  actions: {
    expire: 'Expire the access token',
    forget: 'Forget local changes',
    revoke: 'Revoke the refresh token',
  },
  close: 'Close the network lab',
  failures: { label: 'Requests that fail', value: '{percent, number}%' },
  force: { label: 'Every request answers', ok: 'As it should' },
  intro: "These change the API client's settings while the app runs. Nothing else in the app knows.",
  latency: { label: 'Latency', value: '{ms, number} ms' },
  offline: 'Offline',
  tabs: { flags: 'Flags', label: 'Activity', network: 'API client', tracked: 'Inspector' },
  title: 'Network lab',
  toggle: '{faults, plural, =0 {Network lab} one {Network lab, # fault on} other {Network lab, # faults on}}',
  token: { label: 'Access token lifetime, from the next sign-in or refresh', minutes: '{minutes, number} min' },
};
