// The wizard's flow, with services the test controls.
import { formOf, startFlow } from 'framework/testing'
import type { Listed } from '@/services/products/types'
import * as form from './form'
import * as wizard from './state'

const item = (id: number, price: number): Listed => ({ id, title: `Product ${id}`, description: '', category: 'desks', price, stock: 1, rating: 4, thumbnail: '', version: 1 })
const items = [item(1, 100), item(2, 50), item(3, 10)]

async function atPreview(save: (input: { id: number }) => Promise<unknown>) {
  const fields = formOf(form)
  const go = vi.fn()
  const search = vi.fn(async () => ({ items, total: 3, page: 1, pages: 1 }))
  const flow = startFlow(wizard, { services: { products: { search, save } }, form: fields, navigation: { go } })
  await flow.settled()
  flow.send({ type: 'next' })
  fields.set('percent', 20)
  flow.send({ type: 'next' })
  return { flow, fields, go, search }
}

test('every product of the list starts selected, and the steps go in order', async () => {
  const { flow, fields, search } = await atPreview(async () => ({}))
  expect(search).toHaveBeenCalledWith({ q: '', category: '', sort: 'title', order: 'asc', page: 1 })
  expect(fields.values.selected).toEqual([1, 2, 3])
  expect(flow.states).toEqual(['previewing'])
  flow.send({ type: 'back' })
  expect(flow.states).toEqual(['settingRule'])
})

test('another category reads its products', async () => {
  const { flow, fields, search } = await atPreview(async () => ({}))
  flow.send({ type: 'back' })
  flow.send({ type: 'back' })
  flow.send({ type: 'categoryChanged', category: 'audio' })
  await flow.settled()
  expect(fields.values.category).toBe('audio')
  expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'audio' }))
})

test('nothing selected, or a rule that cannot be applied, does not move on', async () => {
  const { flow, fields } = await atPreview(async () => ({}))
  flow.send({ type: 'back' })
  fields.set('percent', 0)
  flow.send({ type: 'next' })
  expect(flow.states).toEqual(['settingRule'])
  flow.send({ type: 'back' })
  fields.set('selected', [])
  flow.send({ type: 'next' })
  expect(flow.states).toEqual(['choosing'])
})

test('applying saves each selected product in order; a failure is kept and the rest go on', async () => {
  const save = vi.fn(async ({ id }: { id: number }) => {
    if (id === 2) throw new Error('The server answered 500.')
    return {}
  })
  const { flow, fields } = await atPreview(save)
  fields.set('selected', [1, 2, 3])
  flow.send({ type: 'apply' })
  await flow.settled()

  expect(save.mock.calls.map(([input]) => input)).toEqual([
    { id: 1, changes: { price: 80 }, version: 1 },
    { id: 2, changes: { price: 40 }, version: 1 },
    { id: 3, changes: { price: 8 }, version: 1 },
  ])
  expect(flow.states).toEqual(['summary'])
  expect(flow.context['results']).toEqual([
    { id: 1, title: 'Product 1', from: 100, to: 80, error: null },
    { id: 2, title: 'Product 2', from: 50, to: 40, error: 'The server answered 500.' },
    { id: 3, title: 'Product 3', from: 10, to: 8, error: null },
  ])
})

test('the failed ones are sent again, and only those', async () => {
  let down = true
  const save = vi.fn(async ({ id }: { id: number }) => {
    if (down && id !== 1) throw new Error('The server answered 500.')
    return {}
  })
  const { flow } = await atPreview(save)
  flow.send({ type: 'apply' })
  await flow.settled()
  expect(wizard.hasFailures({ context: flow.context } as never)).toBe(true)

  down = false
  save.mockClear()
  flow.send({ type: 'retryFailed' })
  await flow.settled()
  expect(save.mock.calls.map(([input]) => input.id)).toEqual([2, 3])
  expect(wizard.hasFailures({ context: flow.context } as never)).toBe(false)
  expect(flow.context['results']).toHaveLength(3)
})
