import { act, render } from '@testing-library/react';
import { createElement, type ReactNode, startTransition, Suspense, use, useState } from 'react';

import { component } from '../component';
import { createQueryClient } from '../data';
import { Root } from '../root';
import { wiredOperations } from './operations.cases';

vi.mock('virtual:framework/clients', () => ({ default: [] }));
// One service, which answers with the entity it is run for.
vi.mock('virtual:framework/services', () => ({
  default: [
    {
      meta: { default: () => ({ read: { reads: true } }) },
      module: {
        read:
          ({ entity }: { entity: { id: string } }) =>
          () =>
            Promise.resolve(entity.id),
        write:
          ({ entity }: { entity: { id: string } }) =>
          () =>
            Promise.resolve(entity.id),
      },
      segments: ['tenant'],
    },
  ],
}));

type Props = Record<string, unknown>;
type Tenant = { read: () => Promise<string>; write: () => Promise<string> };
const shop = { id: 'shop' } as never;
const other = { id: 'other' } as never;
const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

/** A component that shows the entity its read was answered for, and offers a write. */
function setup() {
  const seen: { write?: () => Promise<unknown> } = {};
  const Probe = component({
    path: 'components/probe',
    skins: {},
    view: () =>
      Promise.resolve({
        ...wiredOperations({ names: ['write'], status: { write: [] } }),
        async: {
          default: ({ services }: { services: { tenant: Tenant } }) => services.tenant.read(),
          write:
            ({ services }: { services: { tenant: Tenant } }) =>
            () =>
              services.tenant.write(),
        },
        children: [],
        form: undefined,
        props: undefined,
        render: (props: Props) => {
          const async = props['async'] as { default: string; write: () => Promise<unknown> };
          seen.write = async.write;
          return createElement('p', null, async.default);
        },
        state: undefined,
      }) as never,
  });
  return { Probe, seen };
}

test('a render React throws away does not hand its entity to a service that runs meanwhile', async () => {
  const { Probe, seen } = setup();
  // A sibling that never arrives for the other entity: the transition that selects it never commits.
  const never = new Promise<never>(() => undefined);
  const Slow = ({ wait }: { wait: boolean }) => (wait ? use(never) : null);
  let select: (entity: never) => void = () => undefined;
  const client = createQueryClient();
  const Page = () => {
    const [entity, setEntity] = useState(shop);
    select = setEntity;
    return createElement(
      Root,
      { client, entity },
      createElement(
        Suspense,
        { fallback: null },
        createElement(Probe),
        createElement(Slow, { wait: entity === other }),
      ) as ReactNode,
    );
  };
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(createElement(Page));
  });
  await settle();
  expect(shown!.container.textContent).toBe('shop');

  // React renders the page for the other entity, waits for the sibling, and commits nothing.
  await act(async () => startTransition(() => select(other)));
  await settle();
  expect(shown!.container.textContent).toBe('shop');
  // The page shows the shop, so a write made from it is the shop's.
  let written: unknown;
  await act(async () => {
    written = await seen.write!();
  });
  expect(written).toBe('shop');
});

test('an entity React commits is the one the reads on the page are answered for, and the writes after it', async () => {
  const { Probe, seen } = setup();
  let select: (entity: never) => void = () => undefined;
  const client = createQueryClient();
  const Page = () => {
    const [entity, setEntity] = useState(shop);
    select = setEntity;
    return createElement(
      Root,
      { client, entity },
      createElement(Suspense, { fallback: null }, createElement(Probe)) as ReactNode,
    );
  };
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(createElement(Page));
  });
  await settle();
  expect(shown!.container.textContent).toBe('shop');

  await act(async () => select(other));
  await settle();
  expect(shown!.container.textContent).toBe('other');
  let written: unknown;
  await act(async () => {
    written = await seen.write!();
  });
  expect(written).toBe('other');

  // And back: the shop's answer is still in the cache, under its own key.
  await act(async () => select(shop));
  await settle();
  expect(shown!.container.textContent).toBe('shop');
});
