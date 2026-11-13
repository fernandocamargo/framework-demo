// The session's words, in English. Translations: i18n/<locale>.json.
export default {
  signIn: 'Sign in',
  signOut: 'Sign out',
  token: { left: 'Access token: {seconds, number}s left', refreshing: 'Refreshing the access token…' },
  dialog: {
    title: 'Sign in',
    username: 'Username',
    password: 'Password',
    hint: "DummyJSON's demo accounts are public. Fill one in:",
    account: '{name}, {role, select, admin {admin} moderator {moderator} other {user}}',
    cancel: 'Cancel',
    submit: 'Sign in',
  },
  expired: 'Your session has expired. Sign in again to continue.',
  role: '{role, select, admin {Admin} moderator {Moderator} other {User}}',
}
