import { tracking } from '../../../framework/runtime/reads';
import appPage from './props';
import ordersPage from './routes/orders/props';
import orderPage from './routes/orders/routes/:id/props';

test('closing sign-in changes no order links or listing settings', () => {
  const keys = new Set<string>();

  // SAFETY: The listing needs only its permissions, words and displayed address fields.
  const page = ordersPage({
    acl: { allowed: true, role: 'admin' },
    i18n: {},
    route: tracking({ lang: '', page: 1, region: '', signin: true, skin: 'default', world: 'memory' }, keys),
    routes: null,
  } as never);

  expect(page.settings.signin).toBe(false);
  expect(keys.has('signin')).toBe(false);
  expect(page.signInHref).toContain('signin');
});

test.each([true, false])('an order is mounted only with its read grant: %s', (allowed) => {
  // SAFETY: This rule reads only the grants and the displayed route fields.
  expect(
    orderPage({
      acl: { grants: { orders: allowed ? ['read'] : [] } },
      route: { lang: '', params: {}, signin: false, skin: 'default', world: '' },
    } as never).allowed,
  ).toBe(allowed);
});

test.each([
  ['/products/:id', false, false, false],
  ['/products/:id', false, true, true],
  ['/products/:id/edit', false, false, true],
  ['/products/:id/edit', true, false, false],
])(
  'the session only follows an open product while sign-in is asked for: %s, %s, %s',
  (pattern, signedIn, signin, open) => {
    // SAFETY: The page needs only the session, its header's words and the address fields below.
    const page = appPage({
      async: { default: { session: signedIn ? {} : null, world: 'memory' } },
      i18n: { sections: {}, signIn: {}, world: {} },
      pattern,
      settings: { lang: '', signin, skin: 'default', world: 'memory' },
    } as never);

    expect(page.productOpen).toBe(open);
  },
);
