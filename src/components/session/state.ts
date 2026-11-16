// The session's flow. The API client holds the tokens; this chart is what the person sees of
// them: signed out, signing in, signed in (with the time left on the access token), refreshing
// it shortly before it expires, and expired when the refresh is refused. The tabs share the
// session: the chart reads `user`, so it is told when someone signs in or out in another tab.
//
// The access token is short-lived on purpose (one minute by default, set in the network lab),
// so a refresh can be watched. While signed in, the chart looks at the clock once a second.

import type { Session } from '@/clients/dummyjson/http';

import { DEMOS } from './form';

/** The payloads of the events that carry one. */
export type Events = { fillDemo: { username?: string } };

export const description = 'Sign in and out, and keep the access token fresh.';

/** A refresh starts this long before the access token expires. */
export const REFRESH_AHEAD = 15_000;
/** After a refresh that failed for another reason than a refusal, the next one waits this long. */
export const RETRY_AFTER = 10_000;

export const context = () => ({
  error: null as null | string,
  expiresAt: 0,
  /** No refresh is tried before this time. */
  notBefore: 0,
  now: 0,
  user: null as null | Session['user'],
});

// ---- Checks ----------------------------------------------------------------------------------

export const hasSession = ({ event }) => Boolean(event.output);
export const aboutToExpire = ({ context }) =>
  context.now >= context.notBefore && context.expiresAt - context.now <= REFRESH_AHEAD;
export const sessionOver = ({ event }) => event.error instanceof Error && event.error.name === 'SessionError';
/** Who is signed in, as the framework reads it: it follows a sign-in or a sign-out in another tab. */
export const someoneSignedIn = ({ user }) => user !== null;
export const nobodySignedIn = ({ user }) => user === null;

// ---- Changes ---------------------------------------------------------------------------------

/** The one place the flow reads the time. */
export const readClock = () => ({ now: Date.now() });
export const remember = ({ event }) => {
  const session = event.output as Session;
  return { error: null, expiresAt: session.expiresAt, notBefore: 0, user: session.user };
};
export const forget = () => ({ expiresAt: 0, notBefore: 0, user: null });
export const rememberError = ({ event }) => ({
  error: event.error instanceof Error ? event.error.message : String(event.error),
});
export const postpone = ({ context }) => ({ notBefore: context.now + RETRY_AFTER });
/** Fills in one of the demo accounts: the one the event names, or the first. */
export const fillDemo = ({ event, form }) => {
  const account = DEMOS.find(({ username }) => username === event.username) ?? DEMOS[0];
  form.set('username', account.username);
  form.set('password', account.password);
};
export const clearForm = ({ form }) => form.seed(undefined);
export const closeSignIn = ({ navigation }) => navigation.query({ signin: false });
/** Giving up on signing in closes what asked for it, too. */

export const closeEverything = ({ navigation, productOpen }) =>
  productOpen ? navigation.go('/products', {}, { signin: false }) : navigation.query({ signin: false });

export const credentials = ({ form }) => form.payload();

const asking = { cancel: { actions: closeEverything }, fillDemo: { actions: fillDemo }, signIn: 'signingIn' };
/** Someone signed in in another tab: the session they share is read again. */
const signedInElsewhere = { user: { guard: someoneSignedIn, target: 'restoring' } };

export default ({ services }) => ({
  restoring: {
    description: 'After a reload: the tab may still hold a session.',
    invoke: {
      onDone: [{ actions: remember, guard: hasSession, target: 'signedIn' }, { target: 'signedOut' }],
      onError: 'signedOut',
      src: services.auth.session,
    },
  },
  signedOut: {
    on: { ...asking, ...signedInElsewhere },
  },
  signingIn: {
    invoke: {
      input: credentials,
      onDone: { actions: [remember, clearForm, closeSignIn], target: 'signedIn' },
      onError: { actions: rememberError, target: 'signedOut' },
      src: services.auth.signIn,
    },
  },
  signedIn: {
    after: {
      1000: [
        { guard: aboutToExpire, target: 'refreshing' },
        { reenter: true, target: 'signedIn' },
      ],
    },
    description: 'Looks at the clock once a second, and refreshes the access token shortly before it expires.',
    entry: readClock,
    on: {
      signOut: 'signingOut',
      user: { actions: forget, description: 'Signed out in another tab.', guard: nobodySignedIn, target: 'signedOut' },
    },
  },
  refreshing: {
    invoke: {
      onDone: { actions: remember, target: 'signedIn' },
      onError: [
        { description: 'The refresh token was refused.', guard: sessionOver, target: 'expired' },
        {
          actions: postpone,
          description: 'The network failed: still signed in, and it tries again later.',
          target: 'signedIn',
        },
      ],
      src: services.auth.refresh,
    },
  },
  signingOut: {
    invoke: {
      onDone: { actions: forget, target: 'signedOut' },
      onError: { actions: forget, target: 'signedOut' },
      src: services.auth.signOut,
    },
  },
  expired: {
    description: 'The session is over. Signing out tells everyone who read it.',
    entry: forget,
    invoke: { src: services.auth.signOut },
    on: { ...asking, ...signedInElsewhere },
  },
});

// ---- What the states gallery shows each state with --------------------------------------------

const emily = { firstName: 'Emily', id: 1, image: '', lastName: 'Johnson', username: 'emilys' };

/** What a state needs on screen beyond what the chart starts with: the page asking to sign in, the person, the time left. */
export const examples = {
  expired: { props: { asked: true } },
  refreshing: { context: { expiresAt: 12_000, now: 0, user: emily } },
  signedIn: { context: { expiresAt: 45_000, now: 0, user: emily } },
  signedOut: { props: { asked: true } },
  signingIn: { props: { asked: true }, values: { password: 'emilyspass', username: 'emilys' } },
  signingOut: { context: { expiresAt: 45_000, now: 0, user: emily } },
};
