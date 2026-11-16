// The editor's flow, for a product the address names or a new one at /products/new.
//
// The rules it holds:
// - a save with problems in the form goes nowhere, and shows them;
// - closing with unsaved changes asks first;
// - a save refused because somebody else saved meanwhile is a conflict, not a failure: the
//   person keeps their changes and chooses whose version stays;
// - a failed save keeps the changes, to try again.

import { problems } from './form';

export const description = 'Edit a product, or write a new one, and save it.';

export const context = ({ route }) => ({
  /** Whether a save was tried: problems show from then on. */
  checked: false,
  creating: route.pattern === '/products/new',
  error: null as null | string,
  title: '',
  /** The version the person started from. A save says so, and is refused if the product has moved on. */
  version: 1,
});

// ---- Checks ----------------------------------------------------------------------------------

export const creating = ({ context }) => context.creating;
export const unsaved = ({ form }) => form.unsaved;
export const invalid = ({ form }) => problems(form.values).length > 0;
export const isConflict = ({ event }) => event.error instanceof Error && event.error.name === 'ConflictError';

// ---- Changes ---------------------------------------------------------------------------------

export const seedForm = ({ event, form }) => {
  form.seed(event.output);
  return { checked: false, error: null, title: event.output.title as string, version: event.output.version as number };
};
export const showProblems = () => ({ checked: true });
export const rememberError = ({ event }) => ({
  error: event.error instanceof Error ? event.error.message : String(event.error),
});
export const forgetError = () => ({ error: null });
export const close = ({ navigation }) => navigation.go('/products');

// ---- What the services are given ---------------------------------------------------------------

export const productToRead = ({ route }) => route.params.id ?? 0;
export const changesToSave = ({ context, form, route }) => ({
  changes: form.payload(),
  id: route.params.id ?? 0,
  version: context.version,
});
/** The same changes, whatever the product's version: the person chose to keep theirs. */
export const changesToForce = ({ form, route }) => ({ changes: form.payload(), id: route.params.id ?? 0 });
export const productToCreate = ({ form }) => form.payload();

// The chart is declared from what the person may do: a read-only editor has no `save` at all. When
// that changes (a sign-in, a session that ends), the framework declares it again and the flow keeps
// its place.
export default ({ acl, services }) => ({
  starting: {
    always: [{ guard: creating, target: 'editing' }, { target: 'loading' }],
  },
  loading: {
    description: 'Reading the product. Its values seed the form once.',
    invoke: {
      input: productToRead,
      onDone: { actions: seedForm, target: 'editing' },
      onError: { actions: rememberError, target: 'unavailable' },
      src: services.products.get,
    },
    on: { close: { actions: close } },
  },
  unavailable: {
    description: 'The product could not be read.',
    on: { close: { actions: close }, retry: 'loading' },
  },
  editing: {
    description: 'The person changes the fields.',
    on: {
      ...(acl.allowed && {
        save: [
          { actions: showProblems, guard: invalid },
          { guard: creating, target: 'creating' },
          { target: 'saving' },
        ],
      }),
      close: [{ guard: unsaved, target: 'confirmingDiscard' }, { actions: close }],
    },
  },
  confirmingDiscard: {
    description: 'There are unsaved changes. The person discards them or goes back to them.',
    on: { discard: { actions: close }, keepEditing: 'editing' },
  },
  saving: {
    description: 'The changes are sent, for the version the person started from.',
    entry: forgetError,
    invoke: {
      input: changesToSave,
      onDone: 'saved',
      onError: [
        { guard: isConflict, target: 'conflict' },
        { actions: rememberError, target: 'failed' },
      ],
      src: services.products.save,
    },
  },
  creating: {
    description: 'The new product is sent.',
    entry: forgetError,
    invoke: {
      input: productToCreate,
      onDone: 'saved',
      onError: { actions: rememberError, target: 'failed' },
      src: services.products.create,
    },
  },
  conflict: {
    description:
      'Somebody else saved this product meanwhile. The person keeps their changes or takes the newer version.',
    on: { close: { actions: close }, keepMine: 'overwriting', takeTheirs: 'loading' },
  },
  overwriting: {
    description: "The person's changes are saved over the newer version.",
    invoke: {
      input: changesToForce,
      onDone: 'saved',
      onError: { actions: rememberError, target: 'failed' },
      src: services.products.save,
    },
  },
  failed: {
    description: 'The save failed. The changes are still in the form.',
    on: {
      close: [{ guard: unsaved, target: 'confirmingDiscard' }, { actions: close }],
      edit: 'editing',
      retry: [{ guard: creating, target: 'creating' }, { target: 'saving' }],
    },
  },
  saved: {
    description: 'Saved. The lists that showed the product have read again; the editor closes.',
    entry: close,
  },
});

// ---- What the states gallery shows each state with --------------------------------------------

const lamp = {
  brand: 'Fieldwork',
  category: 'lighting',
  description: 'A tall lamp that arcs over a desk.',
  price: 273.99,
  stock: 58,
  title: 'Arc Floor Lamp',
};

/** What a state needs on screen beyond what the chart starts with: the product read, the form's values. */
export const examples = {
  confirmingDiscard: { context: { title: lamp.title }, values: { ...lamp, price: 249.99 } },
  conflict: { context: { title: lamp.title }, values: { ...lamp, price: 249.99 } },
  creating: { context: { creating: true }, values: { ...lamp, title: 'Reading Lamp' } },
  editing: { context: { title: lamp.title }, values: lamp },
  failed: { context: { error: 'The server answered 500.', title: lamp.title }, values: lamp },
  overwriting: { context: { title: lamp.title }, values: { ...lamp, price: 249.99 } },
  saved: { context: { title: lamp.title }, values: lamp },
  saving: { context: { title: lamp.title }, values: lamp },
  unavailable: { context: { error: "Product with id '99' not found" } },
};
