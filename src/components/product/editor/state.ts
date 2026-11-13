// The editor's flow, for a product the address names (`edit`) or a new one (`create`).
//
// The rules it holds:
// - a save with problems in the form goes nowhere, and shows them;
// - closing with unsaved changes asks first;
// - a save refused because somebody else saved meanwhile is a conflict, not a failure: the
//   person keeps their changes and chooses whose version stays;
// - a failed save keeps the changes, to try again.
import { problems } from './form'

export const description = 'Edit a product, or write a new one, and save it.'

export const context = ({ route }) => ({
  creating: route.create,
  /** The version the person started from. A save says so, and is refused if the product has moved on. */
  version: 1,
  title: '',
  /** Whether a save was tried: problems show from then on. */
  checked: false,
  error: null as string | null,
})

// ---- Checks ----------------------------------------------------------------------------------

export const creating = ({ context }) => context.creating
export const unsaved = ({ form }) => form.unsaved
export const invalid = ({ form }) => Object.keys(problems(form.values)).length > 0
export const isConflict = ({ event }) => event.error instanceof Error && event.error.name === 'ConflictError'

// ---- Changes ---------------------------------------------------------------------------------

export const seedForm = ({ form, event }) => {
  form.seed(event.output)
  return { version: event.output.version as number, title: event.output.title as string, checked: false, error: null }
}
export const showProblems = () => ({ checked: true })
export const rememberError = ({ event }) => ({ error: event.error instanceof Error ? event.error.message : String(event.error) })
export const forgetError = () => ({ error: null })
export const close = ({ navigation }) => navigation.go({ edit: null, create: false })

// ---- What the services are given ---------------------------------------------------------------

export const productToRead = ({ route }) => route.edit ?? 0
export const changesToSave = ({ form, context, route }) => ({ id: route.edit ?? 0, changes: form.payload(), version: context.version })
/** The same changes, whatever the product's version: the person chose to keep theirs. */
export const changesToForce = ({ form, route }) => ({ id: route.edit ?? 0, changes: form.payload() })
export const productToCreate = ({ form }) => form.payload()

export default ({ services }) => ({
  starting: {
    always: [{ guard: creating, target: 'editing' }, { target: 'loading' }],
  },
  loading: {
    description: 'Reading the product. Its values seed the form once.',
    invoke: {
      src: services.products.get,
      input: productToRead,
      onDone: { target: 'editing', actions: seedForm },
      onError: { target: 'unavailable', actions: rememberError },
    },
    on: { close: { actions: close } },
  },
  unavailable: {
    description: 'The product could not be read.',
    on: { retry: 'loading', close: { actions: close } },
  },
  editing: {
    description: 'The person changes the fields.',
    on: {
      save: [{ guard: invalid, actions: showProblems }, { guard: creating, target: 'creating' }, { target: 'saving' }],
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
      src: services.products.save,
      input: changesToSave,
      onDone: 'saved',
      onError: [{ guard: isConflict, target: 'conflict' }, { target: 'failed', actions: rememberError }],
    },
  },
  creating: {
    description: 'The new product is sent.',
    entry: forgetError,
    invoke: {
      src: services.products.create,
      input: productToCreate,
      onDone: 'saved',
      onError: { target: 'failed', actions: rememberError },
    },
  },
  conflict: {
    description: 'Somebody else saved this product meanwhile. The person keeps their changes or takes the newer version.',
    on: { keepMine: 'overwriting', takeTheirs: 'loading', close: { actions: close } },
  },
  overwriting: {
    description: "The person's changes are saved over the newer version.",
    invoke: {
      src: services.products.save,
      input: changesToForce,
      onDone: 'saved',
      onError: { target: 'failed', actions: rememberError },
    },
  },
  failed: {
    description: 'The save failed. The changes are still in the form.',
    on: {
      retry: [{ guard: creating, target: 'creating' }, { target: 'saving' }],
      edit: 'editing',
      close: [{ guard: unsaved, target: 'confirmingDiscard' }, { actions: close }],
    },
  },
  saved: {
    description: 'Saved. The lists that showed the product have read again; the editor closes.',
    entry: close,
  },
})
