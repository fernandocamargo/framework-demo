// The session's flow. The API client holds the tokens; this chart is what the person sees of
// them: signed out, signing in, signed in (with the time left on the access token), refreshing
// it shortly before it expires, and expired when the refresh is refused.
//
// The access token is short-lived on purpose (one minute by default, set in the network lab),
// so a refresh can be watched. While signed in, the chart looks at the clock once a second.
import type { Session } from '@/clients/dummyjson/http'
import { CLOSED } from '@/address'
import { DEMOS } from './form'

/** The payloads of the events that carry one. */
export type Events = { fillDemo: { username?: string } }

export const description = 'Sign in and out, and keep the access token fresh.'

/** A refresh starts this long before the access token expires. */
export const REFRESH_AHEAD = 15_000
/** After a refresh that failed for another reason than a refusal, the next one waits this long. */
export const RETRY_AFTER = 10_000

export const context = () => ({
  user: null as Session['user'] | null,
  expiresAt: 0,
  now: 0,
  /** No refresh is tried before this time. */
  notBefore: 0,
  error: null as string | null,
})

// ---- Checks ----------------------------------------------------------------------------------

export const hasSession = ({ event }) => Boolean(event.output)
export const aboutToExpire = ({ context }) => context.now >= context.notBefore && context.expiresAt - context.now <= REFRESH_AHEAD
export const sessionOver = ({ event }) => event.error instanceof Error && event.error.name === 'SessionError'

// ---- Changes ---------------------------------------------------------------------------------

/** The one place the flow reads the time. */
export const readClock = () => ({ now: Date.now() })
export const remember = ({ event }) => {
  const session = event.output as Session
  return { user: session.user, expiresAt: session.expiresAt, notBefore: 0, error: null }
}
export const forget = () => ({ user: null, expiresAt: 0, notBefore: 0 })
export const rememberError = ({ event }) => ({ error: event.error instanceof Error ? event.error.message : String(event.error) })
export const postpone = ({ context }) => ({ notBefore: context.now + RETRY_AFTER })
/** Fills in one of the demo accounts: the one the event names, or the first. */
export const fillDemo = ({ form, event }) => {
  const account = DEMOS.find(({ username }) => username === event.username) ?? DEMOS[0]
  form.set('username', account.username)
  form.set('password', account.password)
}
export const clearForm = ({ form }) => form.seed(undefined)
export const closeSignIn = ({ navigation }) => navigation.go({ signin: false })
/** Giving up on signing in closes what asked for it, too. */
export const closeEverything = ({ navigation }) => navigation.go(CLOSED)

export const credentials = ({ form }) => form.payload()

const asking = { signIn: 'signingIn', fillDemo: { actions: fillDemo }, cancel: { actions: closeEverything } }

export default ({ services }) => ({
  restoring: {
    description: 'After a reload: the tab may still hold a session.',
    invoke: {
      src: services.auth.session,
      onDone: [{ guard: hasSession, target: 'signedIn', actions: remember }, { target: 'signedOut' }],
      onError: 'signedOut',
    },
  },
  signedOut: {
    on: asking,
  },
  signingIn: {
    invoke: {
      src: services.auth.signIn,
      input: credentials,
      onDone: { target: 'signedIn', actions: [remember, clearForm, closeSignIn] },
      onError: { target: 'signedOut', actions: rememberError },
    },
  },
  signedIn: {
    description: 'Looks at the clock once a second, and refreshes the access token shortly before it expires.',
    entry: readClock,
    after: {
      1000: [
        { guard: aboutToExpire, target: 'refreshing' },
        { target: 'signedIn', reenter: true },
      ],
    },
    on: { signOut: 'signingOut' },
  },
  refreshing: {
    invoke: {
      src: services.auth.refresh,
      onDone: { target: 'signedIn', actions: remember },
      onError: [
        { guard: sessionOver, target: 'expired', description: 'The refresh token was refused.' },
        { target: 'signedIn', actions: postpone, description: 'The network failed: still signed in, and it tries again later.' },
      ],
    },
  },
  signingOut: {
    invoke: { src: services.auth.signOut, onDone: { target: 'signedOut', actions: forget }, onError: { target: 'signedOut', actions: forget } },
  },
  expired: {
    description: 'The session is over. Signing out tells everyone who read it.',
    entry: forget,
    invoke: { src: services.auth.signOut },
    on: asking,
  },
})
