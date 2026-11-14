/**
 * The states gallery's data: every component folder with a `state.ts`, each state of its chart
 * with its `description`, and what a state needs on screen (`export const examples` in the
 * `state.ts`). A page shows each state by rendering the component inside `Pinned` (pin.ts).
 *
 * The charts are declared with a stand-in for the injection that answers anything, so a
 * declaration that branches on what may be done (`...(acl.allowed && { save })`) lists every state
 * it can have.
 */
import charted from 'virtual:framework/charts'
import { buildMachine, type StateModule } from './machine'
import type { Example } from './pin'

export type ChartState = {
  /** The state's dotted path in its chart: `editing`, `form.invalid`. */
  path: string
  /** Its key. */
  name: string
  description: string | undefined
  /** How deep in the chart, from 0. */
  depth: number
}

export type Chart = { path: string; description: string | undefined; states: ChartState[]; examples: Record<string, Example> }

/** Anything: every property is another, and a call returns another. A declaration reads what it likes. */
const anything = (): unknown =>
  new Proxy(function stand() {}, {
    get: (_, key) => (key === Symbol.toPrimitive ? () => '' : anything()),
    apply: () => anything(),
  })

type Node = { key: string; path: string[]; description?: string; states: Record<string, Node> }

function statesOf(module: StateModule): ChartState[] {
  const { machine } = buildMachine('gallery', module, anything() as Record<string, unknown>, { current: anything() as Record<string, unknown> })
  const out: ChartState[] = []
  const walk = (node: Node) => {
    for (const child of Object.values(node.states)) {
      out.push({ path: child.path.join('.'), name: child.key, description: child.description, depth: child.path.length - 1 })
      walk(child)
    }
  }
  walk(machine.root as unknown as Node)
  return out
}

/** Every chart of the app, with its states. */
export async function charts(): Promise<Chart[]> {
  return Promise.all(
    charted.map(async ({ path, state }) => {
      const module = (await state()) as StateModule & { examples?: Record<string, Example> }
      return { path, description: typeof module.description === 'string' ? module.description : undefined, states: statesOf(module), examples: module.examples ?? {} }
    }),
  )
}

/** The component at `path` and what each of its states needs on screen, or nothing when no folder there has a chart. */
export async function chartAt(path: string) {
  const found = charted.find((chart) => chart.path === path)
  if (!found) return null
  const [component, module] = await Promise.all([found.component(), found.state()])
  return { component: component.default, examples: ((module as { examples?: Record<string, Example> }).examples ?? {}) as Record<string, Example> }
}
