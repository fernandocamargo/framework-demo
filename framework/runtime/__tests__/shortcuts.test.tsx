import { act, fireEvent, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { component } from '../component'
import { createQueryClient } from '../data'
import { pipeline, type Interaction } from '../pipeline'
import { Root } from '../root'

vi.mock('virtual:framework/clients', () => ({ default: [] }))
vi.mock('virtual:framework/services', () => ({ default: [] }))

type Props = Record<string, unknown>
const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0))
  })
const entity = { id: 'shop' } as never

/** A component with a chart and keys; its render shows the state it is in. */
const Flow = component({
  path: 'components/flow',
  view: () =>
    Promise.resolve({
      render: ({ className, state }: Props) => {
        const current = state as Record<string, unknown>
        return createElement('p', { className }, Object.keys(current).filter((key) => current[key] === true).join(','), createElement('input', { 'aria-label': 'Name' }))
      },
      props: undefined,
      async: undefined,
      state: {
        default: () => ({
          idle: { on: { start: 'editing' } },
          editing: { on: { save: 'saved' } },
          saved: {},
        }),
      },
      form: undefined,
      shortcuts: {
        // Its order matters: the list shows the keys in this order.
        default: ({ when }: Props) => ({
          s: { label: 'Start', send: 'start' },
          'mod+s': { label: 'Save', send: 'save' },
          '/': { label: 'Name', focus: 'input', when: when !== false },
        }),
      },
      children: [],
    }),
  skins: {},
  reads: { view: [], acl: [], chart: [], state: [] },
})

/** A component that lists the keys on screen, as the framework gives them. */
const Keys = component({
  path: 'components/keys',
  view: () =>
    Promise.resolve({
      render: ({ keyboard }: Props) => {
        const { groups } = keyboard as { groups: { path: string; shortcuts: { keys: string[]; label: string; available: boolean }[] }[] }
        return createElement(
          'ul',
          null,
          groups.flatMap((group) => group.shortcuts.map((shortcut) => createElement('li', { key: shortcut.label }, `${shortcut.keys.join('+')} ${shortcut.label}${shortcut.available ? '' : ' (not now)'}`))),
        )
      },
      props: undefined,
      async: undefined,
      state: undefined,
      form: undefined,
      children: [],
    }),
  skins: {},
  reads: { view: ['keyboard'], acl: [], chart: [], state: [] },
})

async function show(element: ReactNode) {
  let shown: ReturnType<typeof render> | undefined
  await act(async () => {
    shown = render(createElement(Root, { entity, client: createQueryClient() }, element))
  })
  await settle()
  return shown!.container
}

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init })
  })

test('a key sends its event only while the chart takes it, and the list of keys says which work now', async () => {
  const shown = await show(createElement('div', null, createElement(Flow), createElement(Keys)))
  const flow = () => shown.querySelector('p')!.textContent
  const list = () => [...shown.querySelectorAll('li')].map((item) => item.textContent)

  expect(flow()).toBe('idle')
  expect(list()).toEqual(['S Start', 'Ctrl+S Save (not now)', '/ Name'])

  // `mod+s` in `idle`: the chart has no `save` there. The browser's own action is still held back.
  const ignored = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })
  await act(async () => {
    document.body.dispatchEvent(ignored)
  })
  expect(ignored.defaultPrevented).toBe(true)
  expect(flow()).toBe('idle')

  const interactions: Interaction[] = []
  const listen = (event: Event) => interactions.push((event as CustomEvent<Interaction>).detail)
  pipeline.addEventListener('interaction', listen)
  await press('s')
  await settle()
  pipeline.removeEventListener('interaction', listen)
  expect(flow()).toBe('editing')
  expect(list()).toEqual(['S Start (not now)', 'Ctrl+S Save', '/ Name'])
  // The key ran as an interaction of the component, from its shortcuts.ts.
  expect(interactions.map((interaction) => interaction.name)).toEqual(['components/flow#shortcuts.s'])
  expect(interactions[0]!.chain).toEqual(['components/flow'])

  await press('s', { ctrlKey: true })
  expect(flow()).toBe('saved')
})

test('a key without a modifier is the field’s while one has the focus; a key with one still works', async () => {
  const shown = await show(createElement(Flow))
  const flow = () => shown.querySelector('p')!.textContent

  await press('/')
  const input = shown.querySelector('input')!
  expect(document.activeElement).toBe(input)

  await press('s')
  expect(flow()).toBe('idle')
  input.blur()
  await press('s')
  expect(flow()).toBe('editing')

  input.focus()
  await press('s', { ctrlKey: true })
  expect(flow()).toBe('saved')
})

test('a component hidden behind a dialog answers no key', async () => {
  const shown = await show(createElement('div', { 'aria-hidden': 'true' }, createElement(Flow)))
  const flow = () => shown.querySelector('p')!.textContent
  const event = new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true })
  await act(async () => {
    document.body.dispatchEvent(event)
  })
  expect(flow()).toBe('idle')
  // Not the app's while hidden: the page keeps the key.
  expect(event.defaultPrevented).toBe(false)
})
