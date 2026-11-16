import { type AnyStateMachine, createActor } from 'xstate';

export type ChartRoute = { route: string; state: string };
const stateValue = (path: string) =>
  path.split('.').reduceRight<unknown>((inner, key) => (inner === undefined ? key : { [key]: inner }), undefined);

/** A bookmark to a chart's child route starts in the state that names it. */
export function addressedActor(machine: AnyStateMachine, routes: readonly ChartRoute[], pattern?: string) {
  const selected = routes.find(({ route }) => pattern?.endsWith(`/${route}`));
  if (!selected) return createActor(machine);
  const snapshot = machine.resolveState({
    context: createActor(machine).getSnapshot().context,
    value: stateValue(selected.state) as never,
  });
  return createActor(machine, { snapshot });
}
