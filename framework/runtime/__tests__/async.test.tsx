import { act, renderHook } from '@testing-library/react'
import { execute, useOperations, type AsyncModule } from '../async'
import { onFailure, type Failure } from '../pipeline'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const injection = {}

test('an export that throws before it returns a promise fails as a rejection', async () => {
  const thrown = new Error('before the promise')
  let promise: Promise<unknown> | undefined
  expect(() => {
    promise = execute(
      () => {
        throw thrown
      },
      {},
      [],
    )
  }).not.toThrow()
  await expect(promise).rejects.toBe(thrown)
})

test('an operation that throws before it returns a promise ends with its error, reported once', async () => {
  const failures: Failure[] = []
  const stop = onFailure((failure) => failures.push(failure))
  const module: AsyncModule = {
    save: () => {
      throw new Error('thrown at once')
    },
  }
  const { result } = renderHook(() => useOperations('components/demo', module, injection))

  await act(async () => {
    await result.current.save?.().catch(() => undefined)
  })
  await flush()
  stop()

  expect(result.current.save?.pending).toBe(false)
  expect(result.current.save?.error?.message).toBe('thrown at once')
  expect(failures.filter((failure) => failure.error.message === 'thrown at once')).toHaveLength(1)
})

test("an operation's latest call sets its state, whichever call answers last", async () => {
  const answers = new Map<unknown, (value: unknown) => void>()
  const module: AsyncModule = {
    load: () => (id: unknown) => new Promise((resolve) => answers.set(id, resolve)),
  }
  const { result } = renderHook(() => useOperations('components/demo', module, injection))

  let first: Promise<unknown> | undefined
  let second: Promise<unknown> | undefined
  act(() => {
    first = result.current.load?.('a')
  })
  act(() => {
    second = result.current.load?.('b')
  })
  await act(async () => {
    answers.get('b')?.('answer b')
    await second
  })
  expect(result.current.load?.data).toBe('answer b')

  await act(async () => {
    answers.get('a')?.('answer a')
    await first
  })
  expect(result.current.load?.data).toBe('answer b')
  expect(result.current.load?.pending).toBe(false)
  // The earlier call still answers its own caller.
  await expect(first).resolves.toBe('answer a')
})
