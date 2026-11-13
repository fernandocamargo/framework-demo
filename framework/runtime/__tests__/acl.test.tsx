import { act, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { component } from '../component'
import { createQueryClient } from '../data'
import { onFailure, type Failure } from '../pipeline'
import { Root } from '../root'

vi.mock('virtual:framework/clients', () => ({ default: [] }))
vi.mock('virtual:framework/services', () => ({ default: [] }))

type Props = Record<string, unknown>
type Layers = { acl?: (given: Props) => unknown; children?: ReactNode }
const view = (render: (props: Props) => ReactNode, layers: Layers = {}) => () =>
  Promise.resolve({ render, props: undefined, async: undefined, state: undefined, form: undefined, acl: layers.acl ? { default: layers.acl } : undefined, children: [] })
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0))
  })
async function show(element: ReactNode) {
  let shown: ReturnType<typeof render> | undefined
  await act(async () => {
    shown = render(element)
  })
  await settle()
  return {
    container: shown!.container,
    rerender: async (next: ReactNode) => {
      await act(async () => shown!.rerender(next))
      await settle()
    },
  }
}
const entity = { id: 'shop' } as never
type Person = { id: number; role: string } | null

test("a folder's acl.ts reaches every component below it, until one below says otherwise; only those that read it render again", async () => {
  const calls: string[] = []
  const Leaf = component({
    path: 'components/page/leaf',
    view: view(({ acl }) => {
      calls.push('leaf')
      return createElement('i', null, (acl as { allowed: boolean }).allowed ? 'leaf:yes ' : 'leaf:no ')
    }),
    skins: {},
    reads: { view: ['acl'] },
  })
  const Narrow = component({
    path: 'components/page/narrow',
    view: view(({ acl }) => createElement('b', null, (acl as { allowed: boolean }).allowed ? 'narrow:yes ' : 'narrow:no '), {
      acl: ({ acl, user }) => (acl as { allowed: boolean }).allowed && (user as Person)?.role === 'admin',
    }),
    skins: {},
    reads: { view: ['acl', 'user'] },
  })
  const Plain = component({
    path: 'components/page/plain',
    view: view(() => {
      calls.push('plain')
      return createElement('u', null, 'plain')
    }),
    skins: {},
  })
  const Page = component({
    path: 'components/page',
    view: view(() => createElement('div', null, createElement(Leaf), createElement(Narrow), createElement(Plain)), {
      acl: ({ user }) => (user as Person)?.role !== 'user',
    }),
    skins: {},
    reads: { view: ['user'] },
  })
  let person: Person = { id: 1, role: 'admin' }
  // The app declares its own User (src/env.d.ts); these tests use their own.
  const user = (async () => person) as never
  const client = createQueryClient()
  const { container, rerender } = await show(createElement(Root, { entity, client, user }, createElement(Page)))
  expect(container.textContent).toBe('leaf:yes narrow:yes plain')

  // Another person: the user read runs again (here the client is told to refetch it), and the
  // rules with it. The plain component, which reads neither, does not render.
  calls.length = 0
  person = { id: 2, role: 'moderator' }
  await act(async () => {
    await client.invalidateQueries()
  })
  await rerender(createElement(Root, { entity, client, user }, createElement(Page)))
  expect(container.textContent).toBe('leaf:yes narrow:no plain')
  expect(calls).toEqual([])

  person = { id: 3, role: 'user' }
  await act(async () => {
    await client.invalidateQueries()
  })
  await settle()
  expect(container.textContent).toBe('leaf:no narrow:no plain')
  expect(calls).toEqual(['leaf'])
})

test('a rule that throws refuses, and is reported as the acl layer', async () => {
  const failures: Failure[] = []
  const stop = onFailure((failure) => failures.push(failure))
  const Guarded = component({
    path: 'components/guarded',
    view: view(({ acl }) => createElement('p', null, (acl as { allowed: boolean }).allowed ? 'yes' : 'no'), {
      acl: () => {
        throw new Error('no rule')
      },
    }),
    skins: {},
    reads: { view: ['acl'] },
  })
  const { container } = await show(createElement(Root, { entity, client: createQueryClient() }, createElement(Guarded)))
  expect(container.textContent).toBe('no')
  expect(failures.map((failure) => [failure.layer, failure.path, failure.error.message])).toContainEqual(['acl', 'components/guarded', 'no rule'])
  stop()
})

test('a component follows only the parts of the backend snapshot it reads', async () => {
  const calls: string[] = []
  const Decision = component({
    path: 'components/decision',
    view: view(({ acl }) => {
      calls.push('decision')
      return createElement('i', null, (acl as { allowed: boolean }).allowed ? 'yes ' : 'no ')
    }),
    skins: {},
    reads: { view: ['acl'] },
  })
  const Limit = component({
    path: 'components/limit',
    view: view(({ acl }) => {
      calls.push('limit')
      return createElement('b', null, String((acl as { limits: { change: number } }).limits.change))
    }),
    skins: {},
    reads: { view: ['acl'] },
  })
  let snapshot = { role: 'moderator', limits: { change: 20 } }
  const acl = (async () => snapshot) as never
  const client = createQueryClient()
  const { container } = await show(createElement(Root, { entity, client, acl }, createElement(Decision), createElement(Limit)))
  expect(container.textContent).toBe('yes 20')

  calls.length = 0
  snapshot = { role: 'admin', limits: { change: 50 } }
  await act(async () => {
    await client.invalidateQueries()
  })
  await settle()
  expect(container.textContent).toBe('yes 50')
  expect(calls).toEqual(['limit'])
})
