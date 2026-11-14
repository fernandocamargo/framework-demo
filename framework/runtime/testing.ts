/**
 * For tests of a `state.ts`: the flow as the framework runs it, without React. The sources a
 * component would be given (`services`, `form`, `route`, `navigation`…) are whatever the test
 * passes, so a test states the world, sends events, and reads where the flow is.
 *
 *   const form = formOf(editorForm, product)
 *   const flow = startFlow(editor, { services: { products: { save } }, form })
 *   flow.send({ type: 'save' })
 *   await flow.settled()
 *   expect(flow.states).toEqual(['saved'])
 */

import { createActor } from 'xstate'
import type { I18n } from './i18n-types'
import { build, intlFor } from './i18n'
import { buildMachine, type StateModule } from './machine'

/**
 * For tests of a `props.ts` or a `state.ts`: a folder's `i18n` as the component gets it, in the
 * source language, or in a locale with the translations given (`{ "components/x/title": "…" }`).
 *
 *   const i18n = messagesOf(catalogueI18n)
 *   shape({ i18n, intl: intlOf('en'), async: { default: answer } })
 */
export function messagesOf<Module extends { default: object }>(module: Module, locale = 'en', translated: Record<string, string> = {}, path = 'test') {
  return build({ path, i18n: module }, translated, intlFor(locale)) as unknown as I18n<Module>
}

/** react-intl's `intl` for a locale, as components get it. */
export const intlOf = (locale = 'en') => intlFor(locale)

type Sources = Record<string, unknown>

export function startFlow(module: object, sources: Sources = {}) {
  // What a component gets when nothing above it says otherwise: everything allowed, nobody signed in.
  sources = { acl: { allowed: true }, user: null, ...sources }
  const live = { current: sources }
  const { machine, flags } = buildMachine('test', module as StateModule, sources, live)
  const actor = createActor(machine)
  actor.start()
  return {
    send: (event: { type: string } & Record<string, unknown>) => actor.send(event),
    /** The states the flow is in, outermost first. */
    get states() {
      const snapshot = actor.getSnapshot()
      return flags.filter(({ path }) => snapshot.matches(path as never)).map(({ name }) => name)
    },
    /** What the flow remembers. */
    get context() {
      return actor.getSnapshot().context as Record<string, unknown>
    },
    /** Resolves once the services the flow called have answered. */
    settled: async () => {
      for (let turn = 0; turn < 10; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0))
    },
    stop: () => actor.stop(),
  }
}

type FormModule<Data, Values, Payload> = { seed: (data: Data) => Values; payload?: (values: Values) => Payload }

/**
 * A component's form as its flow sees it, from its `form.ts`, without React: the values, `set`,
 * `seed`, `payload()` and `unsaved`, as the framework keeps them for a component.
 */
export function formOf<Data, Values extends Record<string, unknown>, Payload>(module: FormModule<Data, Values, Payload>, data?: Data) {
  let initial = module.seed(data as Data)
  let values = initial
  return {
    get values() {
      return values
    },
    get initial() {
      return initial
    },
    get unsaved() {
      return Object.keys({ ...initial, ...values }).some((key) => !Object.is(initial[key], values[key]))
    },
    set<Name extends keyof Values>(name: Name, value: Values[Name]) {
      values = { ...values, [name]: value }
    },
    seed(next: Data) {
      initial = values = module.seed(next)
    },
    payload: () => (module.payload ? module.payload(values) : (values as unknown as Payload)),
  }
}
