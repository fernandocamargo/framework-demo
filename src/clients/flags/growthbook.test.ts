// GrowthBook as an OpenFeature provider, on a payload given in the test (no network): targeting
// by the person's id and role, and a change said only when GrowthBook's flags change.

import { GrowthBook } from '@growthbook/growthbook';
import { ProviderEvents } from '@openfeature/web-sdk';

import { growthbookProvider } from './growthbook';

const payload = (stockCountDefault: boolean) => ({
  features: {
    'large-change-at': { defaultValue: 50, rules: [{ condition: { role: 'moderator' }, force: 10 }] },
    'stock-count': { defaultValue: stockCountDefault, rules: [{ condition: { role: 'admin' }, force: true }] },
  },
});

test('flags are targeted by role, and a change is said only when the flags change, not the person', async () => {
  const growthbook = new GrowthBook({});
  const provider = growthbookProvider(growthbook, { payload: payload(false) });
  await provider.initialize!({ role: 'admin', targetingKey: '1' });
  expect(provider.resolveBooleanEvaluation('stock-count', false, {}, console).value).toBe(true);
  expect(provider.resolveNumberEvaluation('large-change-at', 50, {}, console).value).toBe(50);
  expect(provider.resolveBooleanEvaluation('missing', true, {}, console)).toMatchObject({
    errorCode: 'FLAG_NOT_FOUND',
    value: true,
  });

  const changed = vi.fn();
  provider.events!.addHandler(ProviderEvents.ConfigurationChanged, changed);
  await provider.onContextChange!({ role: 'admin', targetingKey: '1' }, { role: 'moderator', targetingKey: '2' });
  expect(provider.resolveBooleanEvaluation('stock-count', false, {}, console).value).toBe(false);
  expect(provider.resolveNumberEvaluation('large-change-at', 50, {}, console).value).toBe(10);
  expect(changed).not.toHaveBeenCalled();

  // What the stream does with a change made in GrowthBook's dashboard.
  await growthbook.setPayload(payload(true));
  expect(changed).toHaveBeenCalledTimes(1);
  expect(provider.resolveBooleanEvaluation('stock-count', false, {}, console).value).toBe(true);
});
