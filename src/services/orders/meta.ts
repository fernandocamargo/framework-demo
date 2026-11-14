// The orders are only read: nothing in the app changes them, so no write makes them stale. A list
// is good for five minutes, as DummyJSON's carts change only when somebody buys.
export default () => ({
  get: { reads: true },
  list: { freshFor: 5 * 60_000, reads: true },
});
