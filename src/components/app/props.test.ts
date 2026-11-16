import '@/address.setup';
// The page's rule: changing the catalogue needs a session.

import codec from 'virtual:framework/address';

import { messagesOf } from 'framework/testing';

import * as messages from './i18n';
import shape from './props';

const session = {
  expiresAt: 0,
  user: { firstName: 'Emily', id: 1, image: '', lastName: 'Johnson', username: 'emilys' },
};
const i18n = messagesOf(messages);
const page = (answer: { pattern?: string; session: null | typeof session; signin?: boolean }) =>
  shape({
    async: { default: { pattern: '/products', signin: false, world: 'memory', ...answer } },
    className: 'components/app',
    i18n,
    navigating: false,
    route: codec.at('/products', {}, '', '').route,
    routes: null,
  } as never);

test('reading needs no session', () => {
  expect(page({ pattern: '/products/:id', session: null })).toMatchObject({ askToSignIn: false, signInReason: null });
});

test.each(['/products/:id/edit', '/products/new', '/products/:id/remove', '/products/bulk', '/products/bulk/confirm'])(
  '%o without a session asks to sign in, and says why',
  (pattern) => {
    expect(page({ pattern, session: null })).toMatchObject({
      askToSignIn: true,
      signInReason: 'Sign in to change the catalogue.',
    });
  },
);

test('with a session, nothing asks', () => {
  expect(page({ pattern: '/products/:id/edit', session, signin: true })).toMatchObject({
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
      default: { pattern: '/products/:id/edit', session: null, signin: false, world: 'memory' },
    },
    className: 'components/app',
    i18n: translated,
    navigating: false,
    route: codec.at('/products', {}, '', '').route,
  } as never);
  expect(shaped.signInReason).toBe('Entre para mudar o catálogo.');
});
