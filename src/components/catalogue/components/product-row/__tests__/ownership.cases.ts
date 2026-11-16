import { act, fireEvent, render, waitFor, within } from '@testing-library/react';
import { Activity, createElement, type ReactNode } from 'react';
import clientModules from 'virtual:framework/clients';
import serviceModules from 'virtual:framework/services';

import stockMeta from '@/services/products/meta';
import type { Listed } from '@/services/products/types';
import { bound, createQueryClient, type Env, onFailure, Root, whenIdle } from 'framework';

import * as operations from '../../../../../../framework/runtime/async';
import { component } from '../../../../../../framework/runtime/component';
import * as hot from '../../../../../../framework/runtime/hot';
import * as rowProps from '../props';

type StockVisit = {
  actors: Set<{ getSnapshot: () => { context: { running: readonly AbortController[] } } }>;
  owners: string[];
  products: Listed[];
  writes: { id: number; reject: (error: Error) => void; resolve: () => void; signal: AbortSignal; stock: number }[];
};

const observed: StockVisit = {
  actors: new Set(),
  owners: [],
  products: [],
  writes: [],
};

const clients: typeof clientModules = [
  { folder: 'local', module: { default: () => ({ changed: () => () => undefined }) } },
];

const services: typeof serviceModules = [
  {
    meta: {
      default: (given) => {
        // SAFETY: Root supplies the injection used by the real products metadata.
        return stockMeta(given as Parameters<typeof stockMeta>[0]);
      },
    },
    module: {
      search: () => async () => ({ items: observed.products, page: 1, pages: 1, total: observed.products.length }),
      setStock:
        () =>
        ({ id, stock }: { id: number; stock: number }) =>
          new Promise<void>((resolve, reject) => {
            const signal = [...observed.actors]
              .flatMap((actor) => actor.getSnapshot().context.running)
              .find((call) => !observed.writes.some((write) => write.signal === call.signal))!.signal;

            observed.writes.push({
              id,
              reject,
              resolve: () => {
                observed.products = observed.products.map((product) =>
                  product.id === id ? { ...product, local: 'edited', stock, version: product.version + 1 } : product,
                );
                resolve();
              },
              signal,
              stock,
            });
            // The real service ignores cancellation; this fake answers it to exercise the owner.
            signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), {
              once: true,
            });
          }),
    },
    segments: ['products'],
  },
];

// SAFETY: These filters use the catalogue's literal sort and order values.
const filters = { category: '', order: 'asc', page: 1, q: '', sort: 'title' } as const;
const path = 'components/catalogue/components/product-row';
const entity = { id: 'memory' };
const env: Env = { apiUrl: '', world: 'memory' };
const lamp = rowProps.examples['In stock'].props.product;
const products: Listed[] = [lamp, { ...lamp, id: 23, stock: 0, title: 'Desk Lamp' }];

export function cases(mode: string) {
  const originalClients = [...clientModules];
  const originalServices = [...serviceModules];
  const useOperation = operations.useOperation;

  beforeAll(() => vi.spyOn(hot, 'HOT', 'get').mockReturnValue(mode === 'dev'));
  afterAll(() => vi.restoreAllMocks());
  afterEach(() => {
    clientModules.splice(0, clientModules.length, ...originalClients);
    serviceModules.splice(0, serviceModules.length, ...originalServices);
  });
  beforeEach(() => {
    clientModules.splice(0, clientModules.length, ...clients);
    serviceModules.splice(0, serviceModules.length, ...services);
    // Observe native ownership without changing the export or injection the command captures.
    vi.spyOn(operations, 'useOperation').mockImplementation((...args: Parameters<typeof useOperation>) => {
      const result = useOperation(...args);
      observed.actors.add(result[1]);
      observed.owners.push(args[0]);

      return result;
    });
    observed.actors.clear();
    observed.owners.length = 0;
    observed.products = products;
    observed.writes.length = 0;
  });

  async function show(
    options: { allow?: boolean; counting?: boolean; fixedRow?: boolean; live?: boolean; role?: string } = {},
  ) {
    const { default: Row } = await import('..');

    const Gate = component({
      path: 'components/stock-permission',
      skins: {},
      view: () =>
        Promise.resolve({
          acl: { default: ({ allow }: { allow: boolean }) => allow },
          async: undefined,
          form: undefined,
          props: undefined,
          render: ({ children }) => {
            // SAFETY: The test passes only React elements as children.
            return children as ReactNode;
          },
          state: undefined,
        }),
    });

    const Page = component({
      path: 'components/stock-page',
      reads: { view: ['async'] },
      skins: {},
      view: () =>
        Promise.resolve({
          async: {
            default: ({ services }: { services: { products: { search: () => Promise<{ items: Listed[] }> } } }) =>
              services.products.search(),
          },
          form: undefined,
          props: undefined,
          render: ({ async }) =>
            createElement(
              'ul',
              null,
              // SAFETY: Page's query above returns the listed products.
              (async as { default: { items: Listed[] } }).default.items.map((product) =>
                bound(createElement(Row, { filters, key: product.id, product })),
              ),
            ),
          state: undefined,
        }),
    });

    const client = createQueryClient();
    let counting = options.counting ?? true;
    const flags = async () => ({ deletions: false, stockCount: counting });
    const acl = async () => ({ role: options.role ?? 'admin' });

    const content = (items = products, activity: 'hidden' | 'visible' = 'visible', hidden = false) =>
      createElement(
        Root,
        {
          // SAFETY: The row reads only role from this backend snapshot.
          acl: acl as never,
          client,
          entity,
          env,
          // SAFETY: The row and remove link read only these two flags.
          flags: flags as never,
        },
        bound(
          createElement(
            Gate,
            { allow: options.allow ?? true },
            createElement(Activity, {
              children: createElement(
                'div',
                { hidden },
                options.live
                  ? bound(createElement(Page))
                  : createElement(
                      'ul',
                      null,
                      items.map((product, index) =>
                        bound(createElement(Row, { filters, key: options.fixedRow ? index : product.id, product })),
                      ),
                    ),
              ),
              mode: activity,
            }),
          ),
        ),
      );

    const shown = await act(async () => render(content()));
    await shown.findByRole('link', { name: 'Arc Floor Lamp' });
    await act(whenIdle);

    return {
      ...shown,
      change: async (items: Listed[], activity: 'hidden' | 'visible' = 'visible', hidden = false) => {
        await act(async () => shown.rerender(content(items, activity, hidden)));
      },
      count: async (value: boolean) => {
        counting = value;
        await act(async () => {
          await client.invalidateQueries();
        });
        await waitFor(() => expect(shown.queryAllByRole('group')).toHaveLength(value ? products.length : 0));
      },
    };
  }

  const group = (shown: Awaited<ReturnType<typeof show>>, title = 'Arc Floor Lamp') =>
    shown.getByRole('group', { name: `Stock of ${title}` });

  const press = async (element: HTMLElement, name = 'One more in stock') => {
    await act(async () => {
      fireEvent.click(within(element).getByRole('button', { name }));
    });
  };

  const finish = async (index: number, error?: Error) => {
    await act(async () => {
      if (error) observed.writes[index]!.reject(error);
      else observed.writes[index]!.resolve();
    });
  };

  test(`${mode}: pending belongs to Count; keyed rows keep independent work through a reorder`, async () => {
    const shown = await show();
    const rows = vi.spyOn(rowProps, 'default');
    const first = group(shown);
    const second = group(shown, 'Desk Lamp');
    const before = observed.owners.length;
    expect(within(second).getByRole('button', { name: 'One less in stock' }).hasAttribute('disabled')).toBe(true);
    await press(first);
    expect(first.getAttribute('aria-busy')).toBe('true');
    expect(second.hasAttribute('aria-busy')).toBe(false);
    expect(rows).not.toHaveBeenCalled();
    await shown.change([...products].reverse());
    expect(group(shown)).toBe(first);
    expect(group(shown, 'Desk Lamp')).toBe(second);
    expect(observed.writes[0]!.signal.aborted).toBe(false);
    await press(second);
    expect(observed.writes.map(({ id, stock }) => [id, stock])).toEqual([
      [22, 59],
      [23, 1],
    ]);
    rows.mockClear();
    await finish(0);
    expect(first.hasAttribute('aria-busy')).toBe(false);
    expect(second.getAttribute('aria-busy')).toBe('true');
    await finish(1);
    expect(second.hasAttribute('aria-busy')).toBe(false);
    expect(rows).not.toHaveBeenCalled();
    expect(observed.actors.size).toBe(2);
    expect(observed.owners.length - before).toBe(4);
    expect(new Set(observed.owners)).toEqual(new Set([`${path}/components/count`]));
    rows.mockRestore();
  });

  test(`${mode}: optimistic stock and failure rollback still reach the row`, async () => {
    const failures = vi.fn();
    const off = onFailure(failures);

    try {
      const shown = await show({ live: true });
      const first = group(shown);
      const button = within(first).getByRole('button', { name: 'One more in stock' });
      button.focus();
      await press(first);
      await waitFor(() =>
        expect(first.parentElement!.querySelector('[itemprop="inventoryLevel"]')?.getAttribute('value')).toBe('59'),
      );
      expect(group(shown)).toBe(first);
      expect(document.activeElement).toBe(button);
      await finish(0, new Error('refused'));
      await act(whenIdle);
      expect(first.parentElement!.querySelector('[itemprop="inventoryLevel"]')?.getAttribute('value')).toBe('58');
      expect(failures).toHaveBeenCalledTimes(1);
      await press(first);
      await finish(1);
      await act(whenIdle);
      expect(first.parentElement!.querySelector('[itemprop="inventoryLevel"]')?.getAttribute('value')).toBe('59');
      expect(document.activeElement).toBe(button);
    } finally {
      off();
    }
  });

  test(`${mode}: changed stock, title and id reach the next command`, async () => {
    const shown = await show({ fixedRow: true });
    const original = group(shown);
    await shown.change([{ ...lamp, stock: 4, title: 'Renamed Lamp' }]);
    await press(group(shown, 'Renamed Lamp'), 'One less in stock');
    await finish(0);
    await shown.change([{ ...lamp, id: 24, stock: 8, title: 'Another Lamp' }]);
    expect(group(shown, 'Another Lamp')).toBe(original);
    await press(group(shown, 'Another Lamp'));
    await finish(1);
    expect(observed.writes.map(({ id, stock }) => [id, stock])).toEqual([
      [22, 3],
      [24, 9],
    ]);
  });

  test(`${mode}: removing Count aborts its work while the row stays; showing it replays nothing`, async () => {
    const failures = vi.fn();
    const off = onFailure(failures);

    try {
      const shown = await show();
      const row = shown.getByRole('link', { name: 'Arc Floor Lamp' });
      await press(group(shown));
      await shown.count(false);
      expect(shown.getByRole('link', { name: 'Arc Floor Lamp' })).toBe(row);
      await waitFor(() => expect(shown.queryAllByRole('group')).toHaveLength(0));
      expect(observed.writes[0]!.signal.aborted).toBe(true);
      await act(whenIdle);
      await shown.count(true);
      expect(group(shown).hasAttribute('aria-busy')).toBe(false);
      expect(observed.writes).toHaveLength(1);
      expect(failures).not.toHaveBeenCalled();
    } finally {
      off();
    }
  });

  test(`${mode}: HTML hiding keeps work; Activity hiding aborts without a failure or replay`, async () => {
    const failures = vi.fn();
    const off = onFailure(failures);

    try {
      const shown = await show();
      await press(group(shown));
      await shown.change(products, 'visible', true);
      expect(observed.writes[0]!.signal.aborted).toBe(false);
      await shown.change(products, 'hidden');
      expect(observed.writes[0]!.signal.aborted).toBe(true);
      await shown.change(products);
      await act(whenIdle);
      expect(group(shown).hasAttribute('aria-busy')).toBe(false);
      expect(observed.writes).toHaveLength(1);
      expect(failures).not.toHaveBeenCalled();
    } finally {
      off();
    }
  });

  test.each([{ allow: false }, { counting: false }, { role: 'guest' }])(
    `${mode}: the gate %o creates no stock owner`,
    async (options) => {
      const shown = await show(options);
      await waitFor(() => expect(shown.queryAllByRole('group')).toHaveLength(0));
      expect(observed.owners).toEqual([]);
    },
  );
}
