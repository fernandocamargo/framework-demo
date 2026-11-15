import { QueryObserver } from '@tanstack/react-query';

import { createDataLayer, createQueryClient, name, recording, shareByIdentity } from '../data';

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
