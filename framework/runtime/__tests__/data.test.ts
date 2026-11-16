import { notifyManager, QueryObserver } from '@tanstack/react-query';

import { isBusy, watch, whenIdle } from '../activity';
import { createDataLayer, createQueryClient, fromTab, name, recording, shareByIdentity, update } from '../data';
import { type DataEvent, onData, onFailure, toError } from '../pipeline';

test('a storage change supersedes a service read started by an earlier tab message', async () => {
  const client = createQueryClient();
  const data = createDataLayer(client, { id: 'shop' });
  let stock = 58;
  let changed = () => undefined as void;
  let finish = () => undefined as void;
  let started = () => undefined as void;
  const reading = new Promise<void>((resolve) => (started = resolve));
  let delay = false;
  const search = async () => {
    const answer = stock;
    if (delay) {
      delay = false;
      started();
      await new Promise<void>((resolve) => (finish = resolve));
    }
    return answer;
  };
  data.rule('products.search', { follows: (stale) => void (changed = stale), reads: true });
  const query = data.component('components/catalogue', {}, async (record) => {
    record.service('products.search');
    return data.call('products.search', search, []);
  });
  await client.fetchQuery(query);
  const stop = new QueryObserver(client, query).subscribe(() => undefined);
  const unwatch = watch(client);
  const unshare = data.share('storage-race');
  const sender = new BroadcastChannel('storage-race');

  try {
    delay = true;
    const heard = fromTab();
    sender.postMessage({ by: 'products.setStock', invalidate: ['products.search'] });
    await heard;
    await reading;
    stock = 59;
    changed();
    finish();
    await whenIdle();
    expect(client.getQueryData(query.queryKey)).toBe(59);
  } finally {
    sender.close();
    unshare();
    stop();
    unwatch();
    client.clear();
  }
});

test('idle sees the signed-out permissions delivered even when background timers are throttled', async () => {
  const client = createQueryClient();
  const queryKey = ['permissions'];
  client.setQueryData(queryKey, 'admin');
  const observer = new QueryObserver(client, { queryKey, staleTime: Infinity });
  let shown = observer.getCurrentResult().data;
  const stop = observer.subscribe(notifyManager.batchCalls(({ data }) => (shown = data)));

  // A background tab can paint and become idle before its timeout notifications are allowed to run.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    queueMicrotask(() => callback(performance.now())),
  );
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => queueMicrotask(callback));
  const unwatch = watch(client);

  try {
    client.setQueryData(queryKey, 'guest');
    await whenIdle();
    expect(shown).toBe('guest');
  } finally {
    stop();
    unwatch();
    client.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

test.each(['native', 'normalized'])('a %s cancellation rolls back a write without reporting failure', async (kind) => {
  const client = createQueryClient();
  const data = createDataLayer(client, { id: 'shop' });
  const events: DataEvent[] = [];
  const failures: unknown[] = [];
  const offData = onData((event) => events.push(event));
  const offFailure = onFailure((failure) => failures.push(failure));
  const get = () => Promise.resolve(10);
  name(get, 'demo.get');
  data.rule('demo.get', { reads: true });
  data.rule('demo.save', { optimistic: [update(get, () => 11)] });
  await data.call('demo.get', get, []);
  let reject!: (reason: Error) => void;

  const waiting = new Promise((_, no) => {
    reject = no;
  });

  const write = data.call('demo.save', () => waiting, []);
  expect(client.getQueryData(['demo.get', 'shop'])).toBe(11);
  expect(isBusy()).toBe(true);
  const reason = new DOMException('The operation was aborted.', 'AbortError');
  reject(kind === 'native' ? reason : toError(reason));
  const caught = await write.catch((error: Error) => error);
  offData();
  offFailure();
  expect(caught).toBe(reason);
  expect(client.getQueryData(['demo.get', 'shop'])).toBe(10);
  expect(events.flatMap((event) => (event.action === 'write' ? [event.outcome] : []))).toEqual(['sent', 'cancelled']);
  expect(events.filter((event) => event.action === 'rollback')).toHaveLength(1);
  expect(events.filter((event) => event.action === 'stale' || event.action === 'tab')).toEqual([]);
  expect(failures).toEqual([]);
  expect(isBusy()).toBe(false);
  client.clear();
});

test('an operation read twice through the recording is the same function, and its calls are recorded', async () => {
  const list = () => Promise.resolve([]);
  name(list, 'demo.list');
  const calls: string[] = [];
  const services = recording({ demo: { list } }, (path) => {
    calls.push(path);
  });

  expect(services.demo).toBe(services.demo);
  expect(services.demo.list).toBe(services.demo.list);
  await services.demo.list();
  expect(calls).toEqual(['demo.list']);
});

test('a write that succeeds resolves even when a read it makes stale fails to refetch', async () => {
  const client = createQueryClient();
  const data = createDataLayer(client, { id: 'shop' });
  let failing = false;
  const list = () => (failing ? Promise.reject(new Error('the refetch fails')) : Promise.resolve(['a']));
  const save = () => Promise.resolve('saved');
  name(list, 'demo.list');
  name(save, 'demo.save');
  data.rule('demo.list', { reads: true });
  data.rule('demo.save', { invalidates: [list] });

  // A component shows the read, so the invalidation refetches it.
  const observer = new QueryObserver(client, { queryFn: list, queryKey: ['demo.list', 'shop'] });
  const stop = observer.subscribe(() => undefined);
  while (observer.getCurrentResult().status !== 'success') await new Promise((resolve) => setTimeout(resolve, 0));

  failing = true;
  await expect(data.call('demo.save', save, [])).resolves.toBe('saved');
  expect(observer.getCurrentResult().error?.message).toBe('the refetch fails');
  stop();
  client.clear();
});

const row = (id: number, status: string, share = { change: 0, current: id / 10 }) => ({
  id,
  share,
  status,
  type: 'MOV',
});

test('a re-read list in another order keeps each unchanged row, found by its identity', () => {
  const previous = [row(1, 'low'), row(2, 'ok'), row(3, 'ok')];
  // The first row's status changed, and the list (sorted by status) moved it to the end.
  const next = [row(2, 'ok'), row(3, 'ok'), row(1, 'ok')];
  const shared = shareByIdentity(previous, next) as typeof previous;

  expect(shared).not.toBe(previous);
  expect(shared[0]).toBe(previous[1]);
  expect(shared[1]).toBe(previous[2]);
  // The changed row is new, but what did not change in it is kept.
  expect(shared[2]).not.toBe(previous[0]);
  expect(shared[2]).toEqual(next[2]);
  expect(shared[2]?.share).toBe(previous[0]?.share);
});

test('an equal answer is the previous one itself, and items without an id are matched by position', () => {
  const previous = { list: { items: [row(1, 'ok')], tags: [{ name: 'a' }, { name: 'b' }] } };
  expect(shareByIdentity(previous, structuredClone(previous))).toBe(previous);

  const next = { list: { items: [row(1, 'ok')], tags: [{ name: 'b' }, { name: 'a' }] } };
  const shared = shareByIdentity(previous, next) as typeof previous;
  expect(shared.list.items).toBe(previous.list.items);
  expect(shared.list.tags[0]).not.toBe(previous.list.tags[1]);
  expect(shared.list.tags).toEqual(next.list.tags);
});

test('the same id under another type is another item', () => {
  const previous = [{ id: 1, type: 'MOV', value: 1 }];
  const next = [{ id: 1, type: 'FEE', value: 1 }];
  const shared = shareByIdentity(previous, next) as typeof previous;
  expect(shared[0]).not.toBe(previous[0]);
  expect(shared[0]).toEqual(next[0]);
});

test('the query client shares a re-read by identity', () => {
  const client = createQueryClient();
  const first = [row(1, 'low'), row(2, 'ok')];
  client.setQueryData(['demo'], first);
  client.setQueryData(['demo'], [row(2, 'ok'), row(1, 'ok')]);
  const kept = client.getQueryData<typeof first>(['demo']);
  expect(kept?.[0]).toBe(first[1]);
  client.clear();
});

test('a write drops the off-screen component reads it made stale, so a revisit reads them anew', async () => {
  const client = createQueryClient();
  const data = createDataLayer(client, { id: 'shop' });
  let answers = 0;
  const list = () => Promise.resolve(`answer ${++answers}`);
  const save = () => Promise.resolve('saved');
  name(list, 'demo.list');
  name(save, 'demo.save');
  data.rule('demo.list', { reads: true });
  data.rule('demo.save', { invalidates: [list] });
  const options = data.component('components/demo', {}, async (record) => {
    record.service('demo.list');
    return data.call('demo.list', list, []);
  });
  const visit = async () => {
    const observer = new QueryObserver(client, options);
    const stop = observer.subscribe(() => undefined);
    while (observer.getCurrentResult().status !== 'success') await new Promise((resolve) => setTimeout(resolve, 0));
    const shown = observer.getCurrentResult().data;
    stop();
    return shown;
  };

  // A first visit reads; a revisit with no write between shows the cached answer, with no read.
  expect(await visit()).toBe('answer 1');
  expect(await visit()).toBe('answer 1');
  expect(answers).toBe(1);

  // The write drops the off-screen answer and reads nothing more now; the revisit reads anew.
  await data.call('demo.save', save, []);
  expect(client.getQueryState(options.queryKey)).toBeUndefined();
  expect(answers).toBe(1);
  expect(await visit()).toBe('answer 2');
  client.clear();
});
