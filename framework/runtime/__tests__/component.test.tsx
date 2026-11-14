import { act, render, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { component } from '../component'
import { createQueryClient } from '../data'
import { useFormLayer } from '../form'
import { Root } from '../root'

// No app here: the plugin's modules of clients and services are empty.
vi.mock('virtual:framework/clients', () => ({ default: [] }))
vi.mock('virtual:framework/services', () => ({ default: [] }))

type Props = Record<string, unknown>
type Answer = { page: number; meta: { asOf: string } }
const view = (render: (props: Props) => ReactNode, read?: (injection: { route: Props }) => Promise<unknown>) => () =>
  Promise.resolve({
    render,
    props: undefined,
    async: read ? { default: read } : undefined,
    state: undefined,
    form: undefined,
    children: [],
  })
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0))
  })
// React asks for an awaited `act` around anything that may suspend.
async function show(element: ReactNode) {
  let shown: ReturnType<typeof render> | undefined
  await act(async () => {
    shown = render(element)
  })
  await settle()
  const { container, rerender } = shown!
  return {
    container,
    rerender: async (next: ReactNode) => {
      await act(async () => rerender(next))
      await settle()
    },
  }
}
// The app declares its own route and entity (src/env.d.ts); these tests use their own.
const entity = { id: 'shop' } as never

test('a change of route renders no component that has no default read', async () => {
  const calls: string[] = []
  const Plain = component({
    path: 'components/plain',
    view: view(() => {
      calls.push('plain')
      return createElement('p', null, 'plain')
    }),
    skins: {},
  })
  const client = createQueryClient()
  const page = (route: Props) => createElement(Root, { route: route as never, entity, client }, createElement(Plain))
  const { container, rerender } = await show(page({ page: 1 }))
  expect(container.textContent).toBe('plain')
  expect(calls).toEqual(['plain'])

  await rerender(page({ page: 2 }))
  expect(calls).toEqual(['plain'])
  // Nor does it hold a query: a stand-in one would suspend its first render once.
  expect(client.getQueryCache().findAll({ queryKey: ['component', 'components/plain'] })).toHaveLength(0)
})

test('a component with a default read renders again only when the route parameters it read change', async () => {
  const reads: unknown[] = []
  const renders: unknown[] = []
  const Reader = component({
    path: 'components/reader',
    view: view(
      (props) => {
        const answer = (props['async'] as { default: Answer }).default
        renders.push(answer.page)
        return createElement('p', null, `page ${answer.page}`)
      },
      ({ route }) => {
        reads.push(route['page'])
        return Promise.resolve({ page: route['page'], meta: { asOf: 'monday' } })
      },
    ),
    skins: {},
  })
  const client = createQueryClient()
  const page = (route: Props) => createElement(Root, { route: route as never, entity, client }, createElement(Reader))
  const { container, rerender } = await show(page({ page: 1, other: 'a' }))
  expect(container.textContent).toBe('page 1')

  // A parameter its read never looked at: the same answer, and its render is not called.
  await rerender(page({ page: 1, other: 'b' }))
  expect(reads).toEqual([1])
  expect(renders).toEqual([1])

  await rerender(page({ page: 2, other: 'b' }))
  expect(container.textContent).toBe('page 2')
  expect(reads).toEqual([1, 2])
  expect(renders).toEqual([1, 2])
})

test('a new answer keeps the parts equal to the last one shown, so a child given one keeps its memo', async () => {
  const childRenders: unknown[] = []
  const Child = component({
    path: 'components/child',
    view: view((props) => {
      childRenders.push(props['meta'])
      return createElement('span', null, (props['meta'] as Answer['meta']).asOf)
    }),
    skins: {},
  })
  const Parent = component({
    path: 'components/parent',
    view: view(
      (props) => {
        const answer = (props['async'] as { default: Answer }).default
        return createElement('div', null, `page ${answer.page} `, createElement(Child, { meta: answer.meta }))
      },
      ({ route }) => Promise.resolve({ page: route['page'], meta: { asOf: 'monday' } }),
    ),
    skins: {},
  })
  const client = createQueryClient()
  const page = (route: Props) => createElement(Root, { route: route as never, entity, client }, createElement(Parent))
  const { container, rerender } = await show(page({ page: 1 }))
  expect(container.textContent).toBe('page 1 monday')

  // Another page has its own query, and its answer is a new object; its equal `meta` is the old one.
  await rerender(page({ page: 2 }))
  expect(container.textContent).toBe('page 2 monday')
  expect(childRenders).toHaveLength(1)
})

test('the form renders its component only for the values it read, and for a seed; set and seed stay the same functions', () => {
  const module = { seed: (data?: { name: string; city: string }) => ({ name: data?.name ?? '', city: data?.city ?? '' }) }
  let renders = 0
  const { result } = renderHook(() => {
    renders++
    return useFormLayer(module)
  })
  const { set, seed } = result.current.view
  // Nothing read yet: a value changes, and the component does not render. The chart sees it.
  act(() => set('name', 'Lisbon'))
  expect(renders).toBe(1)
  expect(result.current.latest.values).toEqual({ name: 'Lisbon', city: '' })
  expect(result.current.latest.unsaved).toBe(true)

  // It reads `city`: a change of `name` still renders nothing; one of `city` does.
  expect(result.current.view.values.city).toBe('')
  act(() => set('name', 'Porto'))
  expect(renders).toBe(1)
  act(() => set('city', 'Faro'))
  expect(renders).toBe(2)
  expect(result.current.view.values.city).toBe('Faro')
  expect(result.current.view.set).toBe(set)

  // A seed renders it, with the values a field starts from.
  act(() => seed({ name: 'Ana', city: 'Braga' }))
  expect(renders).toBe(3)
  expect(result.current.view.initial).toEqual({ name: 'Ana', city: 'Braga' })
  expect(result.current.view.seed).toBe(seed)
  expect(result.current.latest.unsaved).toBe(false)
})

test('a chart created by a change of route reads that route, not the one before it', async () => {
  const read: unknown[] = []
  const Editor = component({
    path: 'components/editor',
    view: () =>
      Promise.resolve({
        render: (props: Props) => createElement('p', null, String((props['state'] as { context: { id: unknown } }).context.id)),
        props: undefined,
        async: undefined,
        state: {
          context: ({ route }: { route: Props }) => {
            read.push(route['edit'])
            return { id: route['edit'] }
          },
          default: { editing: {} },
        },
        form: undefined,
        children: [],
      }),
    skins: {},
  })
  const client = createQueryClient()
  const page = (route: Props) => createElement(Root, { route: route as never, entity, client }, route['edit'] ? createElement(Editor) : null)
  const { container, rerender } = await show(page({ edit: null }))
  await rerender(page({ edit: 4 }))
  expect(container.textContent).toBe('4')
  expect(read.every((value) => value === 4)).toBe(true)
})
