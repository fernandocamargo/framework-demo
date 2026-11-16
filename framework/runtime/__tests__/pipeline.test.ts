import {
  connect,
  consent,
  currentRoute,
  type Interaction,
  onFailure,
  pipeline,
  report,
  setLocation,
  toError,
} from '../pipeline';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test.each([
  new DOMException('The operation was aborted.', 'AbortError'),
  Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }),
])('cancellation stays recognizable through normalization and every reporting layer: %s', async (abort) => {
  const failures: unknown[] = [];
  const stop = onFailure((failure) => failures.push(failure));
  const normalized = toError(abort);
  const service = report(abort, { layer: 'service' });
  const operation = report(normalized, { layer: 'async' });
  const handler = report(toError(normalized), { layer: 'handler' });
  await flush();
  stop();

  for (const error of [normalized, service, operation, handler]) expect(error).toBe(abort);
  expect(failures).toEqual([]);
});

test('other DOM exceptions and values that merely say AbortError still report once', async () => {
  const failures: Error[] = [];
  const stop = onFailure((failure) => failures.push(failure.error));

  for (const thrown of [new DOMException('Denied', 'SecurityError'), { name: 'AbortError' }, 'AbortError']) {
    const error = report(thrown, { layer: 'service' });
    expect(report(error, { layer: 'async' })).toBe(error);
    expect(report(error, { layer: 'handler' })).toBe(error);
  }

  await flush();
  stop();
  expect(failures).toHaveLength(3);
});

test("failures carry the location Root was told, and the address's hash once it is unset", async () => {
  const routes: string[] = [];
  const stop = onFailure((failure) => routes.push(failure.route));

  const unset = setLocation('/products/12?status=low');
  report(new Error('while told'), { layer: 'global' });
  unset();
  report(new Error('after'), { layer: 'global' });
  await flush();
  stop();

  expect(routes).toEqual(['/products/12?status=low', '#/']);
});

test('unsetting an older location leaves a newer one', () => {
  const unsetOlder = setLocation('/products');
  const unsetNewer = setLocation('/products/12');
  unsetOlder();
  expect(currentRoute()).toBe('/products/12');
  unsetNewer();
  expect(currentRoute()).toBe('#/');
});

test('a listener that throws stops neither the other listeners nor the next failures', async () => {
  // The platform reports a listener's exception instead of rethrowing it from dispatchEvent.
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const onError = (event: ErrorEvent) => event.preventDefault();
  window.addEventListener('error', onError);
  const seen: string[] = [];
  const stopThrowing = onFailure(() => {
    throw new Error('a listener fails');
  });
  const stopSeeing = onFailure((failure) => seen.push(failure.error.message));

  report(new Error('first'), { layer: 'global' });
  report(new Error('second'), { layer: 'global' });
  await flush();
  stopThrowing();
  stopSeeing();
  window.removeEventListener('error', onError);
  quiet.mockRestore();

  expect(seen).toEqual(['first', 'second']);
});

const interaction = (id: number): Interaction => ({
  at: 0,
  chain: [],
  id,
  kind: 'interaction',
  name: 'test',
  route: '#/',
  site: {
    column: 0,
    element: 'button',
    file: 'test',
    handler: 'test',
    id: 'test',
    line: 0,
    path: 'test',
    prop: 'onClick',
  },
});

test('connections flush independently on hiding and disconnect, then stop listening', async () => {
  const first: number[][] = [];
  const second: number[][] = [];

  const stopFirst = connect({
    batch: { ms: 1000, size: 3 },
    map: ({ id }) => id,
    name: 'first',
    purpose: 'pipeline-first-test',
    send: (batch) => first.push(batch),
  });

  const stopSecond = connect({
    map: ({ id }) => id,
    name: 'second',
    purpose: 'pipeline-second-test',
    send: (batch) => second.push(batch),
  });

  consent.grant('pipeline-first-test');
  consent.grant('pipeline-second-test');

  pipeline.emit(interaction(1));
  await flush();
  const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  hidden.mockRestore();
  expect(first).toEqual([[1]]);
  expect(second).toEqual([[1]]);

  pipeline.emit(interaction(2));
  await flush();
  stopFirst();
  stopFirst();
  expect(first).toEqual([[1], [2]]);
  pipeline.emit(interaction(3));
  await flush();
  expect(first).toEqual([[1], [2]]);
  expect(second).toEqual([[1], [2], [3]]);
  stopSecond();
});

test('disconnect drops held events and does not send after later consent', async () => {
  const sent: number[][] = [];

  const stop = connect({
    map: ({ id }) => id,
    name: 'held',
    purpose: 'pipeline-held-test',
    send: (batch) => sent.push(batch),
  });

  pipeline.emit(interaction(4));
  await flush();
  stop();
  consent.grant('pipeline-held-test');
  pipeline.emit(interaction(5));
  await flush();
  expect(sent).toEqual([]);
});

test('disconnect keeps another connection active during a reentrant send', async () => {
  const first: number[][] = [];
  const second: number[][] = [];

  const stopSecond = connect({
    accept: ({ id }) => id === 7,
    map: ({ id }) => id,
    name: 'reentrant-second',
    purpose: 'pipeline-reentrant-second-test',
    send: (batch) => second.push(batch),
  });

  const stopFirst = connect({
    accept: ({ id }) => id === 6,
    batch: { ms: 1000, size: 2 },
    map: ({ id }) => id,
    name: 'reentrant-first',
    purpose: 'pipeline-reentrant-first-test',
    send: (batch) => {
      first.push(batch);
      pipeline.dispatchEvent(new CustomEvent('interaction', { detail: interaction(7) }));
    },
  });

  consent.grant('pipeline-reentrant-first-test');
  consent.grant('pipeline-reentrant-second-test');
  pipeline.emit(interaction(6));
  await flush();
  stopFirst();
  expect(first).toEqual([[6]]);
  expect(second).toEqual([[7]]);
  stopSecond();
});
