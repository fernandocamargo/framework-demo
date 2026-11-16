import { act, render } from '@testing-library/react';
import codec from 'virtual:framework/address';
import appRoutes from 'virtual:framework/routes';
import { waitFor } from 'xstate';

import { formOf, memoryAddress } from 'framework/testing';

import { addressedActor, followChart } from '../../../../../../../framework/runtime/chart-address';
import { buildMachine, type StateModule } from '../../../../../../../framework/runtime/machine';
import * as form from './form';
import * as wizard from './state';

// The chart under the app's routes, on React Router in memory. The router's blocker is a hook, so
// the address is rendered: that is where the chart's say reaches Back and Forward.
const start = async (href: string, save = vi.fn(async () => ({}))) => {
  const { address, element, router, settled } = memoryAddress(codec, appRoutes, href);
  const shown = await act(async () => render(element));
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
    /** Back or Forward, and the router's answer to it. */
    go: async (delta: number) => {
      await act(async () => {
        await router.navigate(delta);
        await settled();
      });
    },
    settled,
    stop: () => {
      unfollow();
      actor.stop();
      shown.unmount();
    },
  };
};
test('the bulk chart keeps its draft through Back and Forward, and refuses Back into confirmation while saving', async () => {
  let finish!: (value: object) => void;
  const saved = new Promise<object>((resolve) => {
    finish = resolve;
  });
  const { actor, address, fields, go, settled, stop } = await start(
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
    await settled();
    expect(address.getSnapshot().path).toBe('/products/bulk/confirm');
    await go(-1);
    expect(actor.getSnapshot().matches('previewing')).toBe(true);
    expect(fields.values).toMatchObject({ percent: 51, selected: [4] });
    await go(1);
    expect(actor.getSnapshot().matches('confirmingLargeChange')).toBe(true);
    actor.send({ type: 'confirm' });
    expect(actor.getSnapshot().matches('applying')).toBe(true);
    await settled();
    expect(address.getSnapshot().path).toBe('/products/bulk');
    // Back would be the confirmation again: the chart refuses while it saves, and the router restores the entry.
    await go(-1);
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
  const { actor, address, settled, stop } = await start('/products/bulk/confirm', save);
  try {
    expect(actor.getSnapshot().matches('confirmingLargeChange')).toBe(true);
    actor.send({ type: 'confirm' });
    expect(actor.getSnapshot().matches('confirmingLargeChange')).toBe(true);
    expect(save).not.toHaveBeenCalled();
    address.navigation.go('/products/bulk');
    await settled();
    await waitFor(actor, (snapshot) => snapshot.matches('choosing'));
    expect(address.getSnapshot().path).toBe('/products/bulk');
  } finally {
    stop();
  }
});

test("a direct confirmation, cancelled by its button, starts product selection at the wizard's address", async () => {
  const { actor, address, settled, stop } = await start('/products/bulk/confirm');
  try {
    actor.send({ type: 'back' });
    await waitFor(actor, (snapshot) => snapshot.matches('choosing'));
    await settled();
    expect(address.getSnapshot().path).toBe('/products/bulk');
  } finally {
    stop();
  }
});
