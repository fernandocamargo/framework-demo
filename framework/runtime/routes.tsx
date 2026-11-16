import {
  type ComponentType,
  createContext,
  createElement,
  type ReactNode,
  use,
  useMemo,
  useSyncExternalStore,
} from 'react';

import type { Address, AddressSnapshot } from './address';

export const AddressContext = createContext<Address | null>(null);
/** The route a component is shown under: its pattern, and its path on screen. */
export const RouteScope = createContext<null | { base: string; pattern: string }>(null);
const ComponentsContext = createContext<Record<string, ComponentType>>({});
const SnapshotContext = createContext<AddressSnapshot | null>(null);

export function Routing({
  address,
  children,
  components,
  snapshot,
}: {
  address: Address;
  children: ReactNode;
  components: Record<string, ComponentType>;
  snapshot?: AddressSnapshot;
}) {
  const current = useAddress(address);
  return (
    <AddressContext value={address}>
      <ComponentsContext value={components}>
        <SnapshotContext value={snapshot ?? current}>{children}</SnapshotContext>
      </ComponentsContext>
    </AddressContext>
  );
}

export const useAddress = (address: Address) =>
  useSyncExternalStore(address.subscribe, address.getSnapshot, address.getSnapshot);

/** The generated element is stable. Only the outlet follows the selected child. */
export function Routes({ owner }: { owner: string }) {
  const address = use(AddressContext);
  const components = use(ComponentsContext);
  const snapshot = use(SnapshotContext);
  if (!address || !snapshot) return null;
  return <Matched address={address} components={components} owner={owner} snapshot={snapshot} />;
}

function Matched({
  address,
  components,
  owner,
  snapshot,
}: {
  address: Address;
  components: Record<string, ComponentType>;
  owner: string;
  snapshot: AddressSnapshot;
}) {
  const child = snapshot.chain.find((route) => route.owner === owner && !route.chart);
  const Component = child && components[child.folder];
  const key = child
    ? address.codec.pathOf(child.path, Object.fromEntries(child.keys.map((name) => [name, snapshot.params[name]!])))
    : '';
  return useMemo(
    () =>
      Component && child ? (
        <RouteScope value={{ base: key, pattern: child.path }}>{createElement(Component, { key })}</RouteScope>
      ) : null,
    [Component, child, key],
  );
}
