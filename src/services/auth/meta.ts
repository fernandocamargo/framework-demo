// Whoever read the session reads it again when it starts, is renewed or ends. The profile and the
// permissions are read again when the session starts or ends; a renewal names the same person.
// In another tab, they follow the session the tabs share, once its change can be read there.
export default ({ clients: { api }, services: { auth } }) => ({
  permissions: { follows: (stale) => api.session.changed(stale), freshFor: 10 * 60_000, reads: true },
  profile: { follows: (stale) => api.session.changed(stale), freshFor: 10 * 60_000, reads: true },
  refresh: { invalidates: [auth.session] },
  session: { follows: (stale) => api.session.changed(stale), reads: true },
  signIn: { invalidates: [auth.session, auth.profile, auth.permissions] },
  signOut: { invalidates: [auth.session, auth.profile, auth.permissions] },
});
