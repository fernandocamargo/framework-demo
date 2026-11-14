// The flags' client on the in-memory provider: targeting by role, a flag served another way, and a
// change made in another tab.

import createFlags from '.'

const admin = { targetingKey: '1', role: 'admin' as const }
const moderator = { targetingKey: '2', role: 'moderator' as const }

beforeEach(() => window.localStorage.clear())

test('each person gets the flags the way they are served, and a change says so', async () => {
  const flags = createFlags({ env: { world: 'memory' } } as never)
  expect(await flags.evaluate(admin)).toEqual({ stockCount: true, deletions: true, largeChangeAt: 50 })
  expect(await flags.evaluate(moderator)).toEqual({ stockCount: false, deletions: true, largeChangeAt: 10 })

  const changed = vi.fn()
  const stop = flags.changed(changed)
  await flags.lab.serve('deletions', 'off')
  expect(changed).toHaveBeenCalledTimes(1)
  expect((await flags.evaluate(admin)).deletions).toBe(false)
  // Kept where every tab of the world reads it.
  expect(JSON.parse(window.localStorage.getItem('memory:flags')!)).toMatchObject({ deletions: 'off' })
  stop()
})

test('a flag served another way in another tab reaches this one', async () => {
  const flags = createFlags({ env: { world: 'memory' } } as never)
  const changed = vi.fn()
  const stop = flags.changed(changed)
  window.localStorage.setItem('memory:flags', JSON.stringify({ stockCount: 'everyone' }))
  window.dispatchEvent(new StorageEvent('storage', { key: 'memory:flags', storageArea: window.localStorage }))
  await vi.waitFor(() => expect(changed).toHaveBeenCalled())
  expect((await flags.evaluate(moderator)).stockCount).toBe(true)
  expect(flags.lab.served()).toEqual({ stockCount: 'everyone', deletions: 'on', largeChangeAt: 'moderators' })
  stop()
})
