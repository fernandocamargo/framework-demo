// The tour's flow, with services the test records.
import { HOME } from '@/address';
import { DEMO } from '@/components/session/form';
import { startFlow } from 'framework/testing';

import * as tour from './state';

/** The fakes, and one log of every call they get, in order. */
function fakes(overrides: { flag?: () => Promise<unknown>; signIn?: () => Promise<unknown> } = {}) {
  const log: unknown[] = [];
  const go = vi.fn((...args: unknown[]) => log.push(['go', ...args]));
  const change = vi.fn(async (changes: unknown) => log.push(['lab', changes]));
  const signIn = vi.fn(overrides.signIn ?? (async (credentials: unknown) => log.push(['signIn', credentials])));
  const serve = vi.fn(overrides.flag ?? (async (input: unknown) => log.push(['flag', input])));
  const services = { auth: { signIn }, flags: { serve }, lab: { change } };
  return { go, log, services };
}

test('start, then next through every step: each step performs its effects in order', async () => {
  const { go, log, services } = fakes();
  const flow = startFlow(tour, { lang: 'en', locale: 'en', navigation: { go, query: go }, services, skin: 'default' });
  await flow.settled();
  expect(flow.states).toEqual(['closed']);

  flow.send({ type: 'start' });
  await flow.settled();
  expect(flow.states).toEqual(['address']);
  expect(go).toHaveBeenLastCalledWith(
    '/products',
    {},
    {
      ...HOME,
      category: '',
      order: 'desc',
      page: 1,
      q: '',
      signin: false,
      sort: 'price',
    },
  );

  for (const name of ['product', 'slow', 'failing', 'healed', 'person', 'flag', 'skin', 'language', 'finished']) {
    flow.send({ type: 'next' });
    await flow.settled();
    expect(flow.states).toEqual([name]);
  }

  expect(log).toEqual([
    ['go', '/products', {}, { ...HOME, order: 'desc', signin: false, sort: 'price' }],
    ['go', '/products/:id', { id: 4 }],
    ['go', '/products', {}, { page: 2 }],
    ['lab', { latency: 1500 }],
    ['go', '/products', { page: 3 }],
    ['lab', { force: 500, latency: 0 }],
    ['go', '/products', { page: 1 }],
    ['lab', { force: 0 }],
    ['signIn', DEMO],
    ['flag', { name: 'stockCount', way: 'everyone' }],
    ['go', { skin: 'broadsheet' }, { replace: true }],
    ['go', { lang: 'pt-BR' }, { replace: true }],
  ]);
  flow.send({ type: 'next' });
  await flow.settled();
  expect(flow.states).toEqual(['closed']);
  flow.stop();
});

test('starting on orders sends the tour to the catalogue', async () => {
  const { go, services } = fakes();
  const flow = startFlow(tour, { navigation: { go, query: go }, route: { pattern: '/orders' }, services });
  flow.send({ type: 'start' });
  await flow.settled();
  expect(flow.states).toEqual(['address']);
  expect(go).toHaveBeenLastCalledWith('/products', {}, expect.objectContaining({ sort: 'price' }));
  flow.stop();
});

test('address has no back, and every other step goes back one step', async () => {
  const { go, services } = fakes();
  const flow = startFlow(tour, { lang: 'en', locale: 'en', navigation: { go, query: go }, services, skin: 'default' });
  flow.send({ type: 'start' });
  flow.send({ type: 'back' });
  expect(flow.states).toEqual(['address']);
  flow.send({ type: 'next' });
  flow.send({ type: 'back' });
  expect(flow.states).toEqual(['address']);
  flow.stop();
});

test('leaving from a step tidies the lab and shows the plain list', async () => {
  const { go, log, services } = fakes();
  const flow = startFlow(tour, { lang: 'en', locale: 'en', navigation: { go, query: go }, services, skin: 'default' });
  flow.send({ type: 'start' });
  for (let step = 0; step < 3; step += 1) flow.send({ type: 'next' });
  await flow.settled();
  expect(flow.states).toEqual(['failing']);

  log.length = 0;
  flow.send({ type: 'leave' });
  await flow.settled();
  expect(flow.states).toEqual(['closed']);
  expect(log).toContainEqual(['lab', { failureRate: 0, force: 0, latency: 0 }]);
  expect(go).toHaveBeenLastCalledWith('/products', {}, { lang: 'en', signin: false, skin: 'default' });
  flow.stop();
});

test('a sign-in that is refused keeps the flow in person, with the reason', async () => {
  const { go, services } = fakes({ signIn: async () => Promise.reject(new Error('Invalid credentials')) });
  const flow = startFlow(tour, { lang: 'en', locale: 'en', navigation: { go, query: go }, services, skin: 'default' });
  flow.send({ type: 'start' });
  for (let step = 0; step < 5; step += 1) flow.send({ type: 'next' });
  await flow.settled();
  expect(flow.states).toEqual(['person']);
  expect(flow.context['error']).toBe('Invalid credentials');
  flow.stop();
});

test('a flag that cannot be served moves on, and says the dashboard owns it', async () => {
  const { go, services } = fakes({ flag: async () => Promise.reject(new Error('Served by GrowthBook')) });
  const flow = startFlow(tour, { lang: 'en', locale: 'en', navigation: { go, query: go }, services, skin: 'default' });
  flow.send({ type: 'start' });
  for (let step = 0; step < 6; step += 1) flow.send({ type: 'next' });
  await flow.settled();
  expect(flow.states).toEqual(['skin']);
  expect(flow.context['remote']).toBe(true);
  flow.stop();
});

test('leaving puts back the locale and the skin the page had when the tour started', async () => {
  const { go, services } = fakes();

  const flow = startFlow(tour, {
    lang: 'en',
    locale: 'en',
    navigation: { go, query: go },
    services,
    skin: 'broadsheet',
  });

  flow.send({ type: 'start' });
  for (let step = 0; step < 9; step += 1) flow.send({ type: 'next' });
  await flow.settled();
  expect(flow.states).toEqual(['finished']);
  expect(go).toHaveBeenLastCalledWith({ lang: 'pt-BR' }, { replace: true });

  flow.send({ type: 'next' });
  await flow.settled();
  expect(flow.states).toEqual(['closed']);
  expect(go).toHaveBeenLastCalledWith('/products', {}, { lang: 'en', signin: false, skin: 'broadsheet' });
  flow.stop();
});

test('leaving keeps an implicit language implicit, so the catalogue links stay the same', async () => {
  const { go, services } = fakes();

  const flow = startFlow(tour, { lang: '', locale: 'en', navigation: { go, query: go }, services, skin: 'default' });

  flow.send({ type: 'start' });
  flow.send({ type: 'next' });
  flow.send({ type: 'next' });
  await flow.settled();
  flow.send({ type: 'leave' });
  await flow.settled();
  expect(go).toHaveBeenLastCalledWith('/products', {}, { lang: '', signin: false, skin: 'default' });
  flow.stop();
});
