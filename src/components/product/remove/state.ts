// Deleting a product: it is named first, so the person confirms the right one.

export const description = 'Confirm, then delete the product the address names.';

export const context = () => ({ error: null as null | string, title: '' });

export const productToRemove = ({ route }) => route.remove ?? 0;
export const rememberTitle = ({ event }) => ({ title: event.output.title as string });
export const rememberError = ({ event }) => ({
  error: event.error instanceof Error ? event.error.message : String(event.error),
});
export const forgetError = () => ({ error: null });
export const close = ({ navigation }) => navigation.go({ remove: null });

// Declared from the folder's decision: for those it refuses, there is nothing to confirm.
export default ({ acl, services }) => ({
  loading: {
    description: 'Reading the product, to name it in the question.',
    invoke: {
      input: productToRemove,
      onDone: { actions: rememberTitle, target: 'confirming' },
      onError: { actions: rememberError, target: 'failed' },
      src: services.products.get,
    },
    on: { cancel: { actions: close } },
  },
  confirming: {
    description: 'The person confirms or cancels.',
    on: { ...(acl.allowed && { confirm: 'removing' }), cancel: { actions: close } },
  },
  removing: {
    description: 'The deletion is sent. The lists that showed the product read again when it succeeds.',
    entry: forgetError,
    invoke: {
      input: productToRemove,
      onDone: { actions: close },
      onError: { actions: rememberError, target: 'failed' },
      src: services.products.remove,
    },
  },
  failed: {
    description: 'The product is still there. The person tries again or gives up.',
    on: { ...(acl.allowed && { confirm: 'removing' }), cancel: { actions: close } },
  },
});

// ---- What the states gallery shows each state with --------------------------------------------

/** What a state needs on screen beyond what the chart starts with: the product's name. */
export const examples = {
  confirming: { context: { title: 'Arc Floor Lamp' } },
  failed: { context: { error: 'The server answered 500.', title: 'Arc Floor Lamp' } },
  // The address that opens it, for Storybook's story of the chart as it runs from here.
  loading: { route: { remove: 22 } },
  removing: { context: { title: 'Arc Floor Lamp' } },
};
