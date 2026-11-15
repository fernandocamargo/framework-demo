/**
 * A stand-in for the form manager, which is a chapter of its own. A component's
 * `form.ts` says how server data becomes the form's values (`seed`) and how the values become a
 * request (`payload`). The framework keeps the values for each instance, and injects the form
 * into the render (`form.values`, `form.initial`, `form.set`) and into the state layer
 * (`form.unsaved`, `form.payload()`, `form.seed(data)`). The state layer seeds the form once.
 *
 * The values live outside React, in a store per instance. A component follows only the values its
 * files read (reads.ts), as it follows the flags: a field that holds what is typed, given
 * `form.initial` as its starting value (`defaultValue`), renders alone as a key is pressed, and
 * the component around it does not render at all. A seed renders whoever read `initial`, or a value
 * it changed. The chart's guards and the operations read the latest values when they run, and
 * follow none.
 *
 * `seed` gets the component's props after the data: `seed(data, props)`. A form whose seed reads
 * a prop follows it: when the props it read change, it is seeded again, with the last data and the
 * new props. That is a field that mirrors a prop (the catalogue's search, the address's text): it
 * shows the form's value, so its own change of the prop does not mount it again, and seeds it with
 * the text it already shows; a change from elsewhere (the back button) seeds it with another. It is
 * seeded again after the commit, so a render React throws away leaves the form as it was.
 */

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { sameParts, tracking } from './reads';

export type FormModule = {
  payload?: (values: never) => unknown;
  seed?: (data: never, props: never) => Record<string, unknown>;
};

type Values = Record<string, unknown>;
type State = { initial: Values; values: Values };

const same = (a: Values, b: Values) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => Object.is(a[key], b[key]));
};

// What a component reads of `initial`, beside the values' keys: then a seed renders it.
const INITIAL = Symbol('initial');

type Store = {
  /** The data the form was last seeded from: a seed that follows the props keeps it. */
  data: unknown;
  listeners: Set<() => void>;
  /** The props the form was last seeded with, and the ones its seed read. */
  props: object;
  read: Set<string>;
  shown: null | { state: State };
  state: State;
};

/**
 * `start`: values over the empty ones, for a component held in one state in the states gallery.
 * `props`: the component's, for a seed that reads them.
 */
export function useFormLayer(module: FormModule, start?: Values, props: object = {}) {
  const [store] = useState<Store>(() => {
    const read = new Set<string>();
    const values = { ...seeded(module, undefined, props, read), ...start };
    return { data: undefined, listeners: new Set(), props, read, shown: null, state: { initial: values, values } };
  });
  // The values this component's files read, and INITIAL when they read `initial`.
  const keys = useRef(new Set<string | typeof INITIAL>()).current;

  // `set` and `seed` stay the same functions for the instance's life, so a part of the form that
  // is given `set` keeps its memo when another field changes.
  const actions = useMemo(() => {
    const change = (state: State) => {
      store.state = state;
      for (const listener of store.listeners) listener();
    };
    return {
      payload: () => (module.payload ? module.payload(store.state.values as never) : store.state.values),
      seed: (data: unknown) => {
        store.data = data;
        const values = seeded(module, data, store.props, store.read);
        change({ initial: values, values });
      },
      set: (name: string, value: unknown) =>
        change({ ...store.state, values: { ...store.state.values, [name]: value } }),
      subscribe: (listener: () => void) => {
        store.listeners.add(listener);
        return () => store.listeners.delete(listener);
      },
    };
  }, [module, store]);

  // What the component shows: the same while the values it read stay as they were, and the seed
  // when it read `initial`.
  const snapshot = () => {
    const { state } = store;
    const shown = store.shown;
    if (
      shown &&
      (shown.state.initial === state.initial || !keys.has(INITIAL)) &&
      sameParts(shown.state.values, state.values, keys as Set<string>)
    )
      return shown;
    return (store.shown = { state });
  };
  const { state } = useSyncExternalStore(actions.subscribe, snapshot, snapshot);

  // A seed that read the props follows them: once a render with other values of those props is
  // committed, the form is seeded again from them.
  useLayoutEffect(() => {
    if (props === store.props) return;
    const before = store.props;
    store.props = props;
    if (store.read.size === 0 || sameParts(before, props, store.read)) return;
    actions.seed(store.data);
  }, [props, store, actions]);

  // The render's form: the values it shows, recording which it reads.
  const view = useMemo(
    () => ({
      get initial() {
        keys.add(INITIAL);
        return state.initial;
      },
      payload: actions.payload,
      seed: actions.seed,
      set: actions.set,
      get unsaved() {
        keys.add('*').add(INITIAL);
        return !same(state.values, state.initial);
      },
      values: tracking(state.values, keys as Set<string>),
    }),
    [state, keys, actions],
  );
  // The chart's and the operations' form: the latest values, when they run.
  const latest = useMemo(
    () => ({
      get initial() {
        return store.state.initial;
      },
      payload: actions.payload,
      seed: actions.seed,
      set: actions.set,
      get unsaved() {
        return !same(store.state.values, store.state.initial);
      },
      get values() {
        return store.state.values;
      },
    }),
    [store, actions],
  );
  return { latest, view };
}

/** The form's values from `seed(data, props)`, adding the props it reads to `read`. */
function seeded(module: FormModule, data: unknown, props: object, read: Set<string>): Values {
  if (!module.seed) return {};
  const seed = module.seed as (data: unknown, props: object) => Values;
  return seed(data, tracking(props, read));
}
