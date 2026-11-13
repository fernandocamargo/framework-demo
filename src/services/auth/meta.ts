// Whoever read the session reads it again when it starts, is renewed or ends.
export default ({ services: { auth } }) => ({
  session: { reads: true },
  signIn: { invalidates: [auth.session] },
  refresh: { invalidates: [auth.session] },
  signOut: { invalidates: [auth.session] },
})
