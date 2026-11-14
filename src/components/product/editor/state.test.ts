// The editor's rules, tested where they are written: the checks as plain functions, and the
// flow itself with the services a test gives it. No React, no network.

import { formOf, startFlow } from 'framework/testing'
import type { Detailed } from '@/services/products/types'
import * as form from './form'
import * as editor from './state'

const product: Detailed = { id: 4, title: 'Audio Interface', description: 'Two inputs.', category: 'audio', brand: 'Tandem', price: 167.99, stock: 64, rating: 4.2, thumbnail: '', images: [], version: 3 }
const conflict = Object.assign(new Error('Somebody else changed this product.'), { name: 'ConflictError' })

function editing(overrides: { save?: (input: unknown) => Promise<unknown>; create?: (input: unknown) => Promise<unknown>; creating?: boolean } = {}) {
  const fields = formOf(form)
  const go = vi.fn()
  const save = vi.fn(overrides.save ?? (async () => ({ id: 4, version: 4 })))
  const create = vi.fn(overrides.create ?? (async () => ({ id: 10_001 })))
  const flow = startFlow(editor, {
    services: { products: { get: async () => product, save, create } },
    form: fields,
    route: { edit: overrides.creating ? null : 4, create: Boolean(overrides.creating) },
    navigation: { go },
  })
  return { flow, fields, go, save, create }
}

test('the checks are plain functions of what they are given', () => {
  expect(editor.unsaved({ form: { unsaved: true } } as never)).toBe(true)
  expect(editor.isConflict({ event: { error: conflict } } as never)).toBe(true)
  expect(editor.isConflict({ event: { error: new Error('offline') } } as never)).toBe(false)
  expect(form.problems({ ...form.seed(product), title: ' ', price: 0 })).toEqual(['title', 'price'])
})

test('the product seeds the form once, and a save sends the changes for the version read', async () => {
  const { flow, fields, save, go } = editing()
  await flow.settled()
  expect(flow.states).toEqual(['editing'])
  expect(fields.values.title).toBe('Audio Interface')

  fields.set('price', 149)
  flow.send({ type: 'save' })
  await flow.settled()
  expect(save).toHaveBeenCalledWith({ id: 4, changes: { ...form.payload(form.seed(product)), price: 149 }, version: 3 })
  expect(flow.states).toEqual(['saved'])
  expect(go).toHaveBeenCalledWith({ edit: null, create: false })
})

test('a save with problems in the form goes nowhere, and shows them', async () => {
  const { flow, fields, save } = editing()
  await flow.settled()
  fields.set('title', '')
  flow.send({ type: 'save' })
  expect(flow.states).toEqual(['editing'])
  expect(flow.context['checked']).toBe(true)
  expect(save).not.toHaveBeenCalled()
})

test('closing with unsaved changes asks first', async () => {
  const { flow, fields, go } = editing()
  await flow.settled()
  flow.send({ type: 'close' })
  expect(go).toHaveBeenCalledTimes(1)

  go.mockClear()
  fields.set('stock', 0)
  flow.send({ type: 'close' })
  expect(flow.states).toEqual(['confirmingDiscard'])
  expect(go).not.toHaveBeenCalled()
  flow.send({ type: 'keepEditing' })
  expect(flow.states).toEqual(['editing'])
  flow.send({ type: 'close' })
  flow.send({ type: 'discard' })
  expect(go).toHaveBeenCalledWith({ edit: null, create: false })
})

test('a save refused as a conflict keeps the changes; keeping mine saves over the newer version', async () => {
  const { flow, fields, save } = editing({ save: vi.fn().mockRejectedValueOnce(conflict).mockResolvedValue({ id: 4, version: 5 }) })
  await flow.settled()
  fields.set('title', 'Mine')
  flow.send({ type: 'save' })
  await flow.settled()
  expect(flow.states).toEqual(['conflict'])
  expect(fields.values.title).toBe('Mine')

  flow.send({ type: 'keepMine' })
  await flow.settled()
  expect(save).toHaveBeenLastCalledWith({ id: 4, changes: expect.objectContaining({ title: 'Mine' }) })
  expect(flow.states).toEqual(['saved'])
})

test('a failed save keeps the changes and can be tried again', async () => {
  const { flow, fields, save } = editing({ save: vi.fn().mockRejectedValueOnce(new Error('The server answered 500.')).mockResolvedValue({ id: 4, version: 4 }) })
  await flow.settled()
  fields.set('title', 'Second try')
  flow.send({ type: 'save' })
  await flow.settled()
  expect(flow.states).toEqual(['failed'])
  expect(flow.context['error']).toBe('The server answered 500.')
  expect(fields.values.title).toBe('Second try')

  flow.send({ type: 'retry' })
  await flow.settled()
  expect(save).toHaveBeenCalledTimes(2)
  expect(flow.states).toEqual(['saved'])
})

test('a new product starts from an empty form and is created, not saved', async () => {
  const { flow, fields, create, save } = editing({ creating: true })
  expect(flow.states).toEqual(['editing'])
  fields.set('title', 'Cork Coaster')
  fields.set('category', 'desks')
  fields.set('price', 7.5)
  flow.send({ type: 'save' })
  await flow.settled()
  expect(create).toHaveBeenCalledWith({ title: 'Cork Coaster', description: '', category: 'desks', brand: '', price: 7.5, stock: 0 })
  expect(save).not.toHaveBeenCalled()
})
