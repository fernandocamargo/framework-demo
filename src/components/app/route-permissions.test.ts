import shape from './routes/orders/routes/:id/props';

test.each([true, false])('an order is mounted only with its read grant: %s', (allowed) => {
  expect(shape({ acl: { grants: { orders: allowed ? ['read'] : [] } } } as never).allowed).toBe(allowed);
});
