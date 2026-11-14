import { act, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

// React DevTools' hook, before React loads: it counts each framework component React renders in a
// commit, even one whose output is the same (perf/recorder.js does the same for the whole app).
const rendered = vi.hoisted(() => {
  const counts = new Map<string, number>()
  const PERFORMED_WORK = 1
  type Fiber = { tag: number; type: unknown; flags: number; alternate: Fiber | null; child: Fiber | null; sibling: Fiber | null }
  const walk = (parent: Fiber) => {
    if (parent.alternate && parent.child === parent.alternate.child) return
    for (let node = parent.child; node; node = node.sibling) {
      const type = typeof node.type === 'function' ? (node.type as { name: string; displayName?: string }) : null
      const view = type !== null && (type.name === 'StatefulView' || type.name === 'StatelessView')
      if (view && node.alternate && (node.flags & PERFORMED_WORK) === PERFORMED_WORK) counts.set(type.displayName!, (counts.get(type.displayName!) ?? 0) + 1)
      walk(node)
    }
  }
  const renderers = new Map<number, unknown>()
  ;(globalThis as Record<string, unknown>)['__REACT_DEVTOOLS_GLOBAL_HOOK__'] = {
    supportsFiber: true,
    isDisabled: false,
    renderers,
    checkDCE() {},
    inject: (renderer: unknown) => (renderers.set(renderers.size + 1, renderer), renderers.size),
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    setStrictMode() {},
    onCommitFiberRoot: (_: number, root: { current: Fiber }) => walk(root.current),
  }
  return counts
})

import { component } from '../component'
import { createQueryClient } from '../data'
import { Root } from '../root'

vi.mock('virtual:framework/clients', () => ({ default: [] }))
vi.mock('virtual:framework/services', () => ({ default: [] }))

type Props = Record<string, unknown>
const entity = { id: 'shop' } as never
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
  const { container, rerender } = shown!
  return {
    container,
    rerender: async (next: ReactNode) => {
      await act(async () => rerender(next))
      await settle()
    },
  }
}
const module = (parts: Props) => () => Promise.resolve({ props: undefined, async: undefined, state: undefined, form: undefined, children: [], ...parts }) as never

test('a component with a default read follows only the route fields its read used: another field does not render it at all', async () => {
  const List = component({
    path: 'components/list',
    view: module({
      render: (props: Props) => createElement('p', null, `page ${(props['async'] as { default: { page: number } }).default.page}`),
      async: { default: ({ route }: { route: Props }) => Promise.resolve({ page: route['page'] }) },
    }),
    skins: {},
  })
  const client = createQueryClient()
  const tree = createElement(List)
  const page = (route: Props) => createElement(Root, { route: route as never, entity, client }, tree)
  const { container, rerender } = await show(page({ page: 1, view: null }))
  expect(container.textContent).toBe('page 1')
  rendered.clear()

  // A dialog opens over the list.
  await rerender(page({ page: 1, view: 7 }))
  expect(rendered.get('components/list')).toBeUndefined()

  await rerender(page({ page: 2, view: 7 }))
  expect(container.textContent).toBe('page 2')
  expect(rendered.get('components/list')).toBeGreaterThan(0)
})

test('a chart reads the route field by field: after its first commit, a change of a field it did not read does not render it', async () => {
  const Editor = component({
    path: 'components/editor',
    view: module({
      render: (props: Props) => createElement('p', null, String((props['state'] as { context: { id: unknown } }).context.id)),
      state: { context: ({ route }: { route: Props }) => ({ id: route['edit'] }), default: { editing: {} } },
    }),
    skins: {},
  })
  const client = createQueryClient()
  const tree = createElement(Editor)
  const page = (route: Props) => createElement(Root, { route: route as never, entity, client }, tree)
  const { container, rerender } = await show(page({ edit: 4, q: 'lamp' }))
  expect(container.textContent).toBe('4')
  rendered.clear()

  await rerender(page({ edit: 4, q: 'desk' }))
  expect(rendered.get('components/editor')).toBeUndefined()
})
