import { formOf, startFlow } from 'framework/testing';

import * as form from './form';
import * as session from './state';

const user = { firstName: 'Emily', id: 1, image: '', lastName: 'Johnson', username: 'emilys' };
const context = (fields: Partial<ReturnType<typeof session.context>>) =>
  ({ context: { ...session.context(), ...fields } }) as never;

test('a refresh is due shortly before the access token expires, and not before a postponed one may go', () => {
  expect(session.aboutToExpire(context({ expiresAt: 60_000, now: 1_000 }))).toBe(false);
  expect(session.aboutToExpire(context({ expiresAt: 60_000, now: 60_000 - session.REFRESH_AHEAD }))).toBe(true);
  expect(session.aboutToExpire(context({ expiresAt: 60_000, notBefore: 65_000, now: 59_000 }))).toBe(false);
});

test('only a refused refresh ends the session', () => {
  expect(
    session.sessionOver({ event: { error: Object.assign(new Error('expired'), { name: 'SessionError' }) } } as never),
  ).toBe(true);
  expect(session.sessionOver({ event: { error: new Error('The network is unreachable.') } } as never)).toBe(false);
});

test('signing in remembers who and until when, clears the form and closes the dialog', async () => {
  const fields = formOf(form);
  const query = vi.fn();
  const signIn = vi.fn(async () => ({ expiresAt: Date.now() + 60_000, user }));
  const flow = startFlow(session, {
    form: fields,
    navigation: { query },
    services: { auth: { refresh: vi.fn(), session: async () => null, signIn, signOut: vi.fn(async () => undefined) } },
  });
  await flow.settled();
  expect(flow.states).toEqual(['signedOut']);

  flow.send({ type: 'fillDemo' });
  expect(fields.payload()).toEqual(form.DEMO);
  flow.send({ type: 'signIn' });
  await flow.settled();
  expect(signIn).toHaveBeenCalledWith(form.DEMO);
  expect(flow.states).toEqual(['signedIn']);
  expect(flow.context['user']).toEqual(user);
  expect(fields.values).toEqual({ password: '', username: '' });
  expect(query).toHaveBeenCalledWith({ signin: false });
  flow.stop();
});

test('wrong credentials stay signed out, with the reason', async () => {
  const flow = startFlow(session, {
    form: formOf(form),
    navigation: { query: vi.fn() },
    services: {
      auth: { session: async () => null, signIn: async () => Promise.reject(new Error('Invalid credentials')) },
    },
  });
  await flow.settled();
  flow.send({ type: 'signIn' });
  await flow.settled();
  expect(flow.states).toEqual(['signedOut']);
  expect(flow.context['error']).toBe('Invalid credentials');
});

test('cancelling a sign-in over a product closes it; on another page only sign-in closes', () => {
  const go = vi.fn();
  const query = vi.fn();
  // SAFETY: The action reads only these navigation functions and the shell's productOpen prop.
  session.closeEverything({ navigation: { go, query }, productOpen: true } as never);
  expect(go).toHaveBeenCalledWith('/products', {}, { signin: false });
  // SAFETY: The same action on a page with no product changes only the global sign-in field.
  session.closeEverything({ navigation: { go, query }, productOpen: false } as never);
  expect(query).toHaveBeenCalledWith({ signin: false });
});
