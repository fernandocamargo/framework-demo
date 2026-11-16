import { type AnyActorRef, type AnyStateMachine, createActor } from 'xstate';

import { type Address, type AddressChange, type ChartAddresses, heldAt } from './address';

/** The route a chart is shown under: its pattern, and its path on screen. */
export type ChartAddress = { address: Address; base: string; pattern: string };
export type ChartRoute = { route: string; state: string };
const stateValue = (path: string) =>
  path.split('.').reduceRight<unknown>((inner, key) => (inner === undefined ? key : { [key]: inner }), undefined);

export const addressesOf = (routes: readonly ChartRoute[], routing: ChartAddress): ChartAddresses => ({
  base: routing.base,
  pattern: routing.pattern,
  segments: routes.map(({ route }) => route),
});

/**
 * A chart created under an address one of its states names starts in that state, before it runs
 * any entry action or service. `pattern` is the pattern of the route being rendered.
 */
export function addressedActor(
  machine: AnyStateMachine,
  routes: readonly ChartRoute[],
  routing: ChartAddress | undefined,
  pattern: string | undefined,
) {
  const selected = routing && routes.find(({ route }) => `${routing.pattern}/${route}` === pattern);
  if (!selected) return createActor(machine);
  const snapshot = machine.resolveState({
    context: createActor(machine).getSnapshot().context,
    value: stateValue(selected.state) as never,
  });
  return createActor(machine, { snapshot });
}

/**
 * The chart's say in a change among its own addresses. Asked, it answers with `can`, which runs its
 * guards and moves nothing. Told, it takes the `address` event, and then says the address its state
 * is: the one asked for when it moved there.
 *
 * It refuses only a change that would take it out of a state that names an address. A state that
 * names none holds none: Back or Forward to an address the chart cannot enter from there passes,
 * and that entry takes the chart's address, so no entry is left that Back cannot pass.
 */
export function followChart(actor: AnyActorRef, routes: readonly ChartRoute[], routing?: ChartAddress) {
  if (!routing || !routes.length) return () => {};
  const addresses = addressesOf(routes, routing);
  const held = () => routes.find(({ state }) => actor.getSnapshot().matches(state))?.route ?? null;
  const event = (change: AddressChange, route: null | string) => ({
    path: change.to.path,
    route,
    traversal: change.traversal,
    type: 'address',
  });
  return routing.address.permit({
    agrees: (change) => {
      const asked = heldAt(addresses, change.to);
      const current = held();
      if (asked === undefined || asked === current) return true;
      return actor.getSnapshot().can(event(change, asked)) || (change.traversal && current === null);
    },
    follows: (change) => {
      const asked = heldAt(addresses, change.to);
      if (asked === undefined) return;
      if (asked !== held() && actor.getSnapshot().can(event(change, asked))) actor.send(event(change, asked));
      routing.address.hold(addresses, held());
    },
  });
}
