import codec from 'virtual:framework/address';
import { waitFor } from 'xstate';

import { formOf } from 'framework/testing';

import { addressedActor } from '../../../../../../../framework/runtime/chart-address';
import { buildMachine } from '../../../../../../../framework/runtime/machine';
import * as form from './form';
import * as wizard from './state';

const start = (path: string) => {
  const fields = formOf(form);
  const go = vi.fn();
  const replace = vi.fn();

  const sources = {
    acl: { allowed: true, grants: { prices: ['update'] } },
    flags: { largeChangeAt: 50 },
    form: fields,
    navigation: { go, replace },
    route: codec.read(path).route,
    services: {
      products: {
        save: vi.fn(async () => ({})),
        search: async () => ({ items: [{ id: 4, price: 100, title: 'Lamp', version: 1 }] }),
      },
    },
  };

  const { machine, routes } = buildMachine('bulk', wizard, sources, { current: sources });
  const actor = addressedActor(machine, routes, sources.route.pattern);
  actor.start();

  return { actor, fields, go, replace, sources };
};

test('confirmation writes its child address; Back follows the parent address and keeps the draft', async () => {
  const { actor, fields, go, sources } = start('/products/bulk');
  try {
    await waitFor(actor, (snapshot) => snapshot.matches('choosing'));
    actor.send({ type: 'next' });
    fields.set('percent', 51);
    actor.send({ type: 'next' });
    actor.send({ type: 'apply' });
    expect(actor.getSnapshot().matches('confirmingLargeChange')).toBe(true);
    expect(go).toHaveBeenLastCalledWith('/products/bulk/confirm');
    sources.route = codec.read('/products/bulk').route;
    actor.send({ type: 'route' });
    expect(actor.getSnapshot().matches('previewing')).toBe(true);
    expect(fields.values).toMatchObject({ percent: 51, selected: [4] });
    sources.route = codec.read('/products/bulk/confirm').route;
    actor.send({ type: 'route' });
    expect(actor.getSnapshot().matches('confirmingLargeChange')).toBe(true);
  } finally {
    actor.stop();
  }
});

test('a direct confirmation cannot submit an absent draft, and cancel replaces its address', async () => {
  const { actor, replace, sources } = start('/products/bulk/confirm');
  try {
    expect(actor.getSnapshot().matches('confirmingLargeChange')).toBe(true);
    actor.send({ type: 'confirm' });
    expect(sources.services.products.save).not.toHaveBeenCalled();
    actor.send({ type: 'back' });
    expect(replace).toHaveBeenCalledWith('/products/bulk');
    await waitFor(actor, (snapshot) => snapshot.matches('choosing'));
  } finally {
    actor.stop();
  }
});
