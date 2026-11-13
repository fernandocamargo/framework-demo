import { currentRoute, onFailure, report, setLocation } from '../pipeline'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

test("failures carry the location Root was told, and the address's hash once it is unset", async () => {
  const routes: string[] = []
  const stop = onFailure((failure) => routes.push(failure.route))

  const unset = setLocation('/products/12?status=low')
  report(new Error('while told'), { layer: 'global' })
  unset()
  report(new Error('after'), { layer: 'global' })
  await flush()
  stop()

  expect(routes).toEqual(['/products/12?status=low', '#/'])
})

test('unsetting an older location leaves a newer one', () => {
  const unsetOlder = setLocation('/products')
  const unsetNewer = setLocation('/products/12')
  unsetOlder()
  expect(currentRoute()).toBe('/products/12')
  unsetNewer()
  expect(currentRoute()).toBe('#/')
})

test('a listener that throws stops neither the other listeners nor the next failures', async () => {
  // The platform reports a listener's exception instead of rethrowing it from dispatchEvent.
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const onError = (event: ErrorEvent) => event.preventDefault()
  window.addEventListener('error', onError)
  const seen: string[] = []
  const stopThrowing = onFailure(() => {
    throw new Error('a listener fails')
  })
  const stopSeeing = onFailure((failure) => seen.push(failure.error.message))

  report(new Error('first'), { layer: 'global' })
  report(new Error('second'), { layer: 'global' })
  await flush()
  stopThrowing()
  stopSeeing()
  window.removeEventListener('error', onError)
  quiet.mockRestore()

  expect(seen).toEqual(['first', 'second'])
})
