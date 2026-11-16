import orderPage from './routes/orders/routes/:id/props';

test.each([true, false])('an order is mounted only with its read grant: %s', (allowed) => {
  // SAFETY: This rule reads only the grants and the displayed route fields.
  expect(
    orderPage({
      acl: { grants: { orders: allowed ? ['read'] : [] } },
      route: { lang: '', params: {}, signin: false, skin: 'default', world: '' },
    } as never).allowed,
  ).toBe(allowed);
});
