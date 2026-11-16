import codec from 'virtual:framework/address';
import { waitFor } from 'xstate';

import { formOf } from 'framework/testing';

import { createAddress } from '../../../../../../../framework/runtime/address';
import { addressedActor, followChart } from '../../../../../../../framework/runtime/chart-address';
import { buildMachine, type StateModule } from '../../../../../../../framework/runtime/machine';
import * as form from './form';
import * as wizard from './state';

const start = (href: string, save = vi.fn(async () => ({}))) => {
  window.history.replaceState(null, '', href);
  const address = createAddress(codec, { browser: window });
  const unlisten = address.listen();
  const fields = formOf(form);
  const source = {
    acl: { allowed: true, grants: { prices: ['update'] } },
    flags: { largeChangeAt: 50 },
    form: fields,
    navigation: address.navigation,
    services: {
      products: { save, search: async () => ({ items: [{ id: 4, price: 100, title: 'Lamp', version: 1 }] }) },
    },
  };
  const routing = { address, base: '/products/bulk', pattern: '/products/bulk' };
  const { machine, routes } = buildMachine(
    'components/app/routes/products/routes/bulk',
    wizard as unknown as StateModule,
    source,
    { current: source },
    routing,
  );
  const actor = addressedActor(machine, routes, routing, address.getSnapshot().pattern);
  const unfollow = followChart(actor, routes, routing);
  actor.start();
  return {
    actor,
    address,
    fields,
    stop: () => {
      unfollow();
      unlisten();
      actor.stop();
    },
  };
};
const traversed = () =>
  new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));

test('the bulk chart keeps its draft through Back and Forward, and refuses Back into confirmation while saving', async () => {
  let finish!: (value: object) => void;
  const saved = new Promise<object>((resolve) => {
    finish = resolve;
  });
  const { actor, address, fields, stop } = start(
    '/products/bulk',
    vi.fn(() => saved),
  );
  try {
    await waitFor(actor, (snapshot) => snapshot.matches('choosing'));
    actor.send({ type: 'next' });
    fields.set('percent', 51);
    actor.send({ type: 'next' });
    actor.send({ type: 'apply' });
    expect(actor.getSnapshot().matches('confirmingLargeChange')).toBe(true);
    expect(address.getSnapshot().path).toBe('/products/bulk/confirm');
    let pending = traversed();
    window.history.back();
    await pending;
    expect(actor.getSnapshot().matches('previewing')).toBe(true);
    expect(fields.values).toMatchObject({ percent: 51, selected: [4] });
    pending = traversed();
    window.history.forward();
    await pending;
    expect(actor.getSnapshot().matches('confirmingLargeChange')).toBe(true);
    actor.send({ type: 'confirm' });
    expect(actor.getSnapshot().matches('applying')).toBe(true);
    const restored = new Promise<void>((resolve) => {
      const listener = () => {
        if (window.location.pathname !== '/products/bulk') return;
        window.removeEventListener('popstate', listener);
        resolve();
      };
      window.addEventListener('popstate', listener);
    });
    window.history.back();
    await restored;
    expect(actor.getSnapshot().matches('applying')).toBe(true);
    expect(address.getSnapshot().path).toBe('/products/bulk');
    finish({});
    await waitFor(actor, (snapshot) => snapshot.matches('summary'));
  } finally {
    stop();
  }
});

test('a direct confirmation starts there, cannot submit an absent draft, and cancel starts product selection', async () => {
  const save = vi.fn(async () => ({}));
  const { actor, address, stop } = start('/products/bulk/confirm', save);
  try {
    expect(actor.getSnapshot().matches('confirmingLargeChange')).toBe(true);
    actor.send({ type: 'confirm' });
    expect(actor.getSnapshot().matches('confirmingLargeChange')).toBe(true);
    expect(save).not.toHaveBeenCalled();
    address.navigation.go('/products/bulk');
    await waitFor(actor, (snapshot) => snapshot.matches('choosing'));
    expect(address.getSnapshot().path).toBe('/products/bulk');
  } finally {
    stop();
  }
});

test("a direct confirmation, cancelled by its button, starts product selection at the wizard's address", async () => {
  const { actor, address, stop } = start('/products/bulk/confirm');
  try {
    actor.send({ type: 'back' });
    await waitFor(actor, (snapshot) => snapshot.matches('choosing'));
    expect(address.getSnapshot().path).toBe('/products/bulk');
  } finally {
    stop();
  }
});
