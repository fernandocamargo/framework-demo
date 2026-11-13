// Deleting a product: it is named first, so the person confirms the right one.

export const description = 'Confirm, then delete the product the address names.'

export const context = () => ({ title: '', error: null as string | null })

export const productToRemove = ({ route }) => route.remove ?? 0
export const rememberTitle = ({ event }) => ({ title: event.output.title as string })
export const rememberError = ({ event }) => ({ error: event.error instanceof Error ? event.error.message : String(event.error) })
export const forgetError = () => ({ error: null })
export const close = ({ navigation }) => navigation.go({ remove: null })

export default ({ services }) => ({
  loading: {
    description: 'Reading the product, to name it in the question.',
    invoke: {
      src: services.products.get,
      input: productToRemove,
      onDone: { target: 'confirming', actions: rememberTitle },
      onError: { target: 'failed', actions: rememberError },
    },
    on: { cancel: { actions: close } },
  },
  confirming: {
    description: 'The person confirms or cancels.',
    on: { confirm: 'removing', cancel: { actions: close } },
  },
  removing: {
    description: 'The deletion is sent. The lists that showed the product read again when it succeeds.',
    entry: forgetError,
    invoke: {
      src: services.products.remove,
      input: productToRemove,
      onDone: { actions: close },
      onError: { target: 'failed', actions: rememberError },
    },
  },
  failed: {
    description: 'The product is still there. The person tries again or gives up.',
    on: { confirm: 'removing', cancel: { actions: close } },
  },
})
