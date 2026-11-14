import { QueryObserver } from '@tanstack/react-query';

import { createDataLayer, createQueryClient, name, recording, update } from '../data';

type Product = { id: number; stock: number };

/** A gate a test opens or breaks, to hold a write on its way. */
function gate() {
  let open: () => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    open = resolve;
    fail = reject;
  });
  return { fail, open, promise };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

/** A product read and a stock write, with a server that holds each write until the test says. */
function setup() {
  const client = createQueryClient();
  const data = createDataLayer(client, { id: 'shop' });
  const server = { reads: 0, stock: 10 };
  const gates: ReturnType<typeof gate>[] = [];
  const get = async (id: number): Promise<Product> => {
    server.reads++;
    return { id, stock: server.stock };
  };
  const setStock = async ({ stock }: { id: number; stock: number }) => {
    const held = gate();
    gates.push(held);
    await held.promise;
    server.stock = stock;
  };
  name(get, 'products.get');
  name(setStock, 'products.setStock');
  data.rule('products.get', { reads: true });
  data.rule('products.setStock', {
    invalidates: [get],
    optimistic: [update(get, (product, { id, stock }) => (product.id === id ? { ...product, stock } : product))],
  });
  const shown = () => client.getQueryData<Product>(['products.get', 'shop', 1])?.stock;
  const send = (stock: number) =>
    data.call('products.setStock', setStock as never, [{ id: 1, stock }]).catch((error: Error) => error);
  return { client, data, gates, get, send, server, setStock, shown };
}

test('a write shows at once; one that fails is taken out, and the others stay (a rebase)', async () => {
  const { data, gates, get, send, server, shown } = setup();
  await data.call('products.get', get as never, [1]);
  expect(shown()).toBe(10);

  const first = send(11);
  expect(shown()).toBe(11);
  const second = send(12);
  expect(shown()).toBe(12);
  await settle();

  // The first is refused: what shows is the server's 10 with the second laid over it.
  gates[0]!.fail(new Error('refused'));
  expect(await first).toBeInstanceOf(Error);
  expect(shown()).toBe(12);

  // A read that lands meanwhile does not undo the write still on its way.
  await data.call('products.get', get as never, [1]);
  expect(server.stock).toBe(10);
  expect(shown()).toBe(12);

  gates[1]!.open();
  await second;
  await settle();
  expect(server.stock).toBe(12);
  expect(shown()).toBe(12);
});

test('a component that read what a write changes is worked out again from the cache, without asking the server', async () => {
  const { client, data, gates, get, send, server } = setup();
  // As the injection gives it: the operation runs through the data layer, and is named by its path.
  const operation = (id: number) => data.call('products.get', get as never, [id]) as Promise<Product>;
  name(operation, 'products.get');
  const query = data.component('components/row', {}, async (record) => {
    const services = recording({ products: { get: operation } }, record.service, record.peek);
    const product = await services.products.get(1);
    return { label: `${product.stock} in stock` };
  });
  await client.fetchQuery(query);
  // On screen: a component observes it. One off screen is read anew when it shows again.
  const stop = new QueryObserver(client, query).subscribe(() => undefined);
  const reads = server.reads;
  expect(client.getQueryData<{ label: string }>(query.queryKey)?.label).toBe('10 in stock');

  const sent = send(9);
  await settle();
  expect(client.getQueryData<{ label: string }>(query.queryKey)?.label).toBe('9 in stock');
  expect(server.reads).toBe(reads);

  // Refused: back to what the server says.
  await settle();
  gates[0]!.fail(new Error('refused'));
  await sent;
  await settle();
  expect(client.getQueryData<{ label: string }>(query.queryKey)?.label).toBe('10 in stock');
  stop();
});

test('a write that succeeds in one tab makes the same reads stale in the others', async () => {
  const one = setup();
  const other = setup();
  const close = [one.data.share('test:tabs'), other.data.share('test:tabs')];
  await other.data.call('products.get', other.get as never, [1]);
  expect(other.client.getQueryState(['products.get', 'shop', 1])?.isInvalidated).toBe(false);

  const sent = one.send(11);
  await settle();
  one.gates[0]!.open();
  await sent;
  await settle();
  expect(other.client.getQueryState(['products.get', 'shop', 1])?.isInvalidated).toBe(true);
  close.forEach((closing) => closing());
});
