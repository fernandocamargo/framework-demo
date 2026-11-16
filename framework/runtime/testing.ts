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

import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createActor } from 'xstate';

import type { ViewModule } from './component';
import { build, intlFor } from './i18n';
import type { I18n } from './i18n-types';
import type { Entity } from './index';
import { buildMachine, type StateModule } from './machine';

export const entity: Entity = { id: 'shop' };

export const settle = (turns = 5) =>
  act(async () => {
    for (let i = 0; i < turns; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

export async function show(element: ReactNode, turns = 5) {
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(element);
  });
  await settle(turns);
  return shown!;
}

export function viewOf<P>(
  render: (props: P) => ReactNode,
  layers: Omit<Partial<ViewModule>, 'acl' | 'render'> & { acl?: (given: P) => boolean } = {},
) {
  return () =>
    Promise.resolve({
      acl: layers.acl ? { default: layers.acl } : undefined,
      async: layers.async,
      children: layers.children ?? [],
      form: layers.form,
      props: layers.props,
      // SAFETY: The test declares the props its folder's props.ts would pass to render.
      render: render as ViewModule['render'],
      shortcuts: layers.shortcuts,
      state: layers.state,
    });
}

/**
 * For tests of a `props.ts` or a `state.ts`: a folder's `i18n` as the component gets it, in the
 * source language, or in a locale with the translations given (`{ "components/x/title": "…" }`).
 *
 *   const i18n = messagesOf(catalogueI18n)
 *   shape({ i18n, intl: intlOf('en'), async: { default: answer } })
 */
export function messagesOf<Module extends { default: object }>(
  module: Module,
  locale = 'en',
  translated: Record<string, string> = {},
  path = 'test',
) {
  return build({ i18n: module, path }, translated, intlFor(locale)) as unknown as I18n<Module>;
}

/** react-intl's `intl` for a locale, as components get it. */
export const intlOf = (locale = 'en') => intlFor(locale);

type Sources = Record<string, unknown>;

export function startFlow(module: object, sources: Sources = {}) {
  // What a component gets when nothing above it says otherwise: everything allowed, nobody signed in.
  sources = { acl: { allowed: true }, user: null, ...sources };
  const live = { current: sources };
  const { flags, machine } = buildMachine('test', module as StateModule, sources, live);
  const actor = createActor(machine);
  actor.start();
  return {
    /** What the flow remembers. */
    get context() {
      return actor.getSnapshot().context as Record<string, unknown>;
    },
    send: (event: Record<string, unknown> & { type: string }) => actor.send(event),
    /** Resolves once the services the flow called have answered. */
    settled: async () => {
      for (let turn = 0; turn < 10; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    },
    /** The states the flow is in, outermost first. */
    get states() {
      const snapshot = actor.getSnapshot();
      return flags.filter(({ path }) => snapshot.matches(path as never)).map(({ name }) => name);
    },
    stop: () => actor.stop(),
  };
}

type FormModule<Data, Values, Payload, Props> = {
  payload?: (values: Values) => Payload;
  seed: (data: Data, props: Props) => Values;
};

/**
 * A component's form as its flow sees it, from its `form.ts`, without React: the values, `set`,
 * `seed`, `payload()` and `unsaved`, as the framework keeps them for a component. `props` are the
 * component's, for a seed that reads them.
 */
export function formOf<Data, Values extends Record<string, unknown>, Payload, Props = Record<string, never>>(
  module: FormModule<Data, Values, Payload, Props>,
  data?: Data,
  props: Props = {} as Props,
) {
  let initial = module.seed(data as Data, props);
  let values = initial;
  return {
    get initial() {
      return initial;
    },
    payload: () => (module.payload ? module.payload(values) : (values as unknown as Payload)),
    seed(next: Data) {
      initial = values = module.seed(next, props);
    },
    set<Name extends keyof Values>(name: Name, value: Values[Name]) {
      values = { ...values, [name]: value };
    },
    get unsaved() {
      return Object.keys({ ...initial, ...values }).some((key) => !Object.is(initial[key], values[key]));
    },
    get values() {
      return values;
    },
  };
}
