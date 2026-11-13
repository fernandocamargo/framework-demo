// Whoever read the session reads it again when it starts, is renewed or ends. The profile is
// read again when the session starts or ends; a renewal names the same person.
export default ({ services: { auth } }) => ({
  session: { reads: true },
  profile: { reads: true, freshFor: 10 * 60_000 },
  signIn: { invalidates: [auth.session, auth.profile] },
  refresh: { invalidates: [auth.session] },
  signOut: { invalidates: [auth.session, auth.profile] },
})
