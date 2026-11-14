// Whoever read the session reads it again when it starts, is renewed or ends. The profile and the
// permissions are read again when the session starts or ends; a renewal names the same person.
// In another tab, they follow the session the tabs share, once its change can be read there.
export default ({ clients: { api }, services: { auth } }) => ({
  session: { reads: true, follows: (stale) => api.session.changed(stale) },
  profile: { reads: true, freshFor: 10 * 60_000, follows: (stale) => api.session.changed(stale) },
  permissions: { reads: true, freshFor: 10 * 60_000, follows: (stale) => api.session.changed(stale) },
  signIn: { invalidates: [auth.session, auth.profile, auth.permissions] },
  refresh: { invalidates: [auth.session] },
  signOut: { invalidates: [auth.session, auth.profile, auth.permissions] },
})
