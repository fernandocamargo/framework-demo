// The page's rule: changing the catalogue needs a session.

import { messagesOf } from 'framework/testing';

import * as messages from './i18n';
import shape from './props';

type Dialogs = { bulk: boolean; create: boolean; edit: null | number; remove: null | number; view: null | number };
const closed: Dialogs = { bulk: false, create: false, edit: null, remove: null, view: null };
const session = {
  expiresAt: 0,
  user: { firstName: 'Emily', id: 1, image: '', lastName: 'Johnson', username: 'emilys' },
};
const i18n = messagesOf(messages);
const page = (answer: { dialogs?: Partial<Dialogs>; session: null | typeof session; signin?: boolean }) =>
  shape({
    async: {
      default: {
        section: 'products',
        signin: false,
        world: 'memory',
        ...answer,
        dialogs: { ...closed, ...answer.dialogs },
      },
    },
    className: 'components/app',
    i18n,
    navigating: false,
  } as never);

test('reading needs no session', () => {
  expect(page({ dialogs: { view: 4 }, session: null })).toMatchObject({ askToSignIn: false, signInReason: null });
});

test.each<Partial<Dialogs>>([{ edit: 4 }, { create: true }, { remove: 4 }, { bulk: true }])(
  '%o without a session asks to sign in, and says why',
  (dialogs) => {
    expect(page({ dialogs, session: null })).toMatchObject({
      askToSignIn: true,
      signInReason: 'Sign in to change the catalogue.',
    });
  },
);

test('with a session, nothing asks', () => {
  expect(page({ dialogs: { edit: 4 }, session, signin: true })).toMatchObject({
    askToSignIn: false,
    signInReason: null,
  });
});

test('the address can ask for the sign-in dialog on its own', () => {
  expect(page({ session: null, signin: true })).toMatchObject({ askToSignIn: true, signInReason: null });
});

test("the reason is in the locale's words", () => {
  const translated = messagesOf(messages, 'pt-BR', { 'test/signIn/reason': 'Entre para mudar o catálogo.' });
  const shaped = shape({
    async: {
      default: { dialogs: { ...closed, edit: 4 }, section: 'products', session: null, signin: false, world: 'memory' },
    },
    className: 'components/app',
    i18n: translated,
    navigating: false,
  } as never);
  expect(shaped.signInReason).toBe('Entre para mudar o catálogo.');
});
