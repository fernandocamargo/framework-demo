import { act, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { component } from '../component'
import { createQueryClient } from '../data'
import { Root } from '../root'

vi.mock('virtual:framework/clients', () => ({ default: [] }))
vi.mock('virtual:framework/services', () => ({ default: [] }))

type Props = Record<string, unknown>
type State = { send: (event: { type: string }) => void } & Record<string, unknown>
const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0))
  })
const entity = { id: 'shop' } as never

/** A component whose chart is declared from `acl`, its rule from the snapshot; its render shows the states it is in. */
function setup(declaration: (injection: { acl: { allowed: boolean } }) => Record<string, unknown>, extra: Record<string, unknown> = {}) {
  let send: State['send'] = () => undefined
  const Flow = component({
    path: 'components/flow',
    view: () =>
      Promise.resolve({
        render: ({ state }: Props) => {
          const current = state as State
          send = current.send
          return createElement('p', null, Object.keys(current).filter((key) => current[key] === true).join(','))
        },
        props: undefined,
        async: undefined,
        state: { default: declaration, ...extra },
        form: undefined,
        acl: { default: ({ acl }: { acl: { grants: string[] } }) => acl.grants.includes('update') },
        children: [],
      }),
    skins: {},
    reads: { view: [], acl: ['acl'], chart: ['acl'], state: [] },
  })
  let grants = ['update']
  const acl = (async () => ({ grants })) as never
  const client = createQueryClient()
  return {
    element: createElement(Root, { entity, client, acl }, createElement(Flow)),
    send: (type: string) => act(async () => send({ type })),
    grant: async (next: string[]) => {
      grants = next
      await act(async () => {
        await client.invalidateQueries()
      })
      await settle()
    },
  }
}

async function show(element: ReactNode) {
  let shown: ReturnType<typeof render> | undefined
  await act(async () => {
    shown = render(element)
  })
  await settle()
  return shown!.container
}

test("a chart declared from acl is declared again when what it read changes, and keeps its place", async () => {
  const flow = setup(({ acl }) => ({
    idle: { on: { start: 'editing' } },
    editing: { on: { ...(acl.allowed && { save: 'saved' }), stop: 'idle' } },
    saved: {},
  }))
  const shown = await show(flow.element)
  await flow.send('start')
  expect(shown.textContent).toBe('editing')

  // The grant goes: the chart is declared with no `save`, still in `editing`.
  await flow.grant([])
  await flow.send('save')
  await settle()
  expect(shown.textContent).toBe('editing')

  // It comes back: `save` is there again, and the flow is where it was.
  await flow.grant(['update'])
  await flow.send('save')
  await settle()
  expect(shown.textContent).toBe('saved')
})

test('a chart running a service moves to the new chart only once it rests', async () => {
  let finish: () => void = () => undefined
  const work = () => new Promise<void>((resolve) => (finish = resolve))
  const flow = setup(
    ({ acl }) => ({
      idle: { on: { start: 'working' } },
      working: { invoke: { src: work, onDone: 'done' } },
      done: { on: { ...(acl.allowed && { again: 'idle' }) } },
    }),
  )
  const shown = await show(flow.element)
  await flow.send('start')
  expect(shown.textContent).toBe('working')

  // Declared again while the service runs: the running chart sees it through.
  await flow.grant([])
  expect(shown.textContent).toBe('working')
  await act(async () => finish())
  await settle()
  expect(shown.textContent).toBe('done')

  // At rest now, in the chart declared without `again`.
  await flow.send('again')
  await settle()
  expect(shown.textContent).toBe('done')
})

test('a chart whose new declaration has no such state starts over', async () => {
  const flow = setup(({ acl }) => (acl.allowed ? { idle: { on: { open: 'special' } }, special: {} } : { idle: {} }))
  const shown = await show(flow.element)
  await flow.send('open')
  expect(shown.textContent).toBe('special')
  await flow.grant([])
  expect(shown.textContent).toBe('idle')
})
