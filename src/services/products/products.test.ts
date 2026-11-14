// The product services, against the memory world: the same client code as the real one, on a
// wire that answers from fixtures. Each test builds its own world, so nothing leaks between them.

import { createStore } from '@/clients/local'
import memory from '@/clients/memory'
import { DEMO } from '@/components/session/form'
import { memoryStorage } from '@/clients/storage'
import * as products from './index'

function world() {
  const env = { world: 'memory' as const, apiUrl: '' }
  const clients = { api: memory({ env }), local: createStore({ storage: memoryStorage() }) }
  // A service takes the injection; these tests give it the two clients it uses.
  const injection = { clients } as Parameters<typeof products.search>[0]
  return { ...clients, injection }
}
const everything = { q: '', category: '', sort: 'title' as const, order: 'asc' as const, page: 1 }

test('a page of the catalogue, sorted and sized by the API', async () => {
  const { injection } = world()
  const page = await products.search(injection)(everything)
  expect(page).toMatchObject({ total: 37, page: 1, pages: 4 })
  expect(page.items).toHaveLength(12)
  expect(page.items[0]).toMatchObject({ title: 'Arc Floor Lamp', version: 1 })
})

test('text within a category is matched over the whole category', async () => {
  const { injection } = world()
  const page = await products.search(injection)({ ...everything, category: 'lighting', q: 'lamp' })
  expect(page.items.map((item) => item.title)).toEqual(['Arc Floor Lamp', 'Clamp Lamp', 'Task Lamp'])
  expect(page.total).toBe(3)
})

test('a write needs a session', async () => {
  const { injection } = world()
  await expect(products.save(injection)({ id: 4, changes: { price: 1 } })).rejects.toMatchObject({ name: 'SessionError' })
})

test('a save changes what the next reads answer, and moves the version on', async () => {
  const { api, injection } = world()
  await api.session.signIn(DEMO)
  expect(await products.save(injection)({ id: 4, changes: { title: 'Renamed' }, version: 1 })).toEqual({ id: 4, version: 2 })
  expect(await products.get(injection)(4)).toMatchObject({ title: 'Renamed', version: 2, local: 'edited' })
  const page = await products.search(injection)({ ...everything, q: 'renamed' })
  // The API still searches its own titles, so the overlay cannot make it find the new one.
  expect(page.items).toEqual([])
})

test('a save from an older version is refused as a conflict', async () => {
  const { api, injection } = world()
  await api.session.signIn(DEMO)
  await products.sellOut(injection)(4)
  await expect(products.save(injection)({ id: 4, changes: { title: 'Mine' }, version: 1 })).rejects.toMatchObject({ name: 'ConflictError', version: 2 })
  // Without a version, the person's changes go over whatever is there.
  await products.save(injection)({ id: 4, changes: { title: 'Mine' } })
  expect(await products.get(injection)(4)).toMatchObject({ title: 'Mine', stock: 0, version: 3 })
})

test('a created product is listed first and can be read, changed and deleted', async () => {
  const { api, injection } = world()
  await api.session.signIn(DEMO)
  const created = await products.create(injection)({ title: 'Cork Coaster', description: '', category: 'desks', brand: '', price: 7.5, stock: 20 })
  expect(created.id).toBe(10_001)
  expect((await products.search(injection)(everything)).items[0]).toMatchObject({ id: 10_001, local: 'created' })
  expect(await products.reviews(injection)(created.id)).toEqual([])

  await products.save(injection)({ id: created.id, changes: { price: 9 }, version: 1 })
  expect(await products.get(injection)(created.id)).toMatchObject({ price: 9, version: 2 })

  await products.remove(injection)(created.id)
  await expect(products.get(injection)(created.id)).rejects.toMatchObject({ name: 'NotFoundError' })
})

test('a deleted product leaves the lists and cannot be read', async () => {
  const { api, injection } = world()
  await api.session.signIn(DEMO)
  await products.remove(injection)(2)
  const page = await products.search(injection)(everything)
  expect(page.items.map((item) => item.id)).not.toContain(2)
  expect(page.total).toBe(36)
  await expect(products.get(injection)(2)).rejects.toThrow('This product was deleted.')
  await products.reset(injection)()
  expect((await products.search(injection)(everything)).total).toBe(37)
})
