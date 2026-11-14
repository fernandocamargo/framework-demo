// The session's words, in English. Translations: i18n/<locale>.json.
export default {
  dialog: {
    account: '{name}, {role, select, admin {admin} moderator {moderator} other {user}}',
    cancel: 'Cancel',
    hint: "DummyJSON's demo accounts are public. Fill one in:",
    password: 'Password',
    submit: 'Sign in',
    title: 'Sign in',
    username: 'Username',
  },
  expired: 'Your session has expired. Sign in again to continue.',
  role: '{role, select, admin {Admin} moderator {Moderator} other {User}}',
  signIn: 'Sign in',
  signOut: 'Sign out',
  token: { left: 'Access token: {seconds, number}s left', refreshing: 'Refreshing the access token…' },
};
