// @vitest-environment node
// @ts-expect-error The plugin is plain JavaScript, with no declarations.
import { transformRender } from '../../plugin/index.mjs'

const transform = (code: string) => (transformRender(code, '/src/components/list/render.tsx', 'components/list', 'components/list/render.tsx', '"framework"') as { code: string } | null)?.code ?? code

test('a function in the JSX that uses nothing of the render moves out of it, so it is the same at every render', () => {
  const code = transform(`
import { ListBox, ListBoxItem } from 'react-aria-components'
export default ({ className, items }) => (
  <ListBox className={className} items={items}>{(item) => <ListBoxItem id={item.slug}>{item.name}</ListBoxItem>}</ListBox>
)`)
  expect(code).toContain('const __constant_0 = (item) => <ListBoxItem id={item.slug}>{item.name}</ListBoxItem>;')
  expect(code).toContain('<ListBox className={className} items={items}>{__constant_0}</ListBox>')
})

test('an attribute that is not a handler moves out too; a handler stays, tracked', () => {
  const code = transform(`
export default ({ send }) => <Tab className={({ isSelected }) => (isSelected ? 'on' : 'off')} onPress={() => send({ type: 'open' })} />`)
  expect(code).toContain("const __constant_0 = ({ isSelected }) => (isSelected ? 'on' : 'off');")
  expect(code).toContain('className={__constant_0}')
  expect(code).toContain("onPress={__track(() => send({ type: 'open' }), __site_0)}")
})

test('a function that reads something of the render stays in it', () => {
  const uses = `
export default ({ latencyText }) => <SliderOutput>{({ state }) => latencyText(state.getThumbValue(0))}</SliderOutput>`
  expect(transform(uses)).toBe(uses)

  // What a list's callback binds is the render's too.
  const inList = `
export default ({ rows }) => <ul>{rows.map((row) => <Row key={row.id}>{(cell) => <Cell row={row.id} cell={cell} />}</Row>)}</ul>`
  expect(transform(inList)).toBe(inList)

  // A local of the render, declared in its body.
  const local = `
export default ({ rows }) => {
  const label = rows.length
  return <Rows>{() => <b>{label}</b>}</Rows>
}`
  expect(transform(local)).toBe(local)
})

test('a function that binds a name of the render again, uses `this`, or holds a handler stays', () => {
  const shadows = `
export default ({ item }) => <List>{(item) => <b>{item}</b>}</List>`
  expect(transform(shadows)).toBe(shadows)

  const handler = `
export default ({ items }) => <List items={items}>{(item) => <Item onAction={() => item.open()} />}</List>`
  expect(transform(handler)).toContain('<List items={items}>{(item) => <Item onAction={__track(() => item.open(), __site_0)} />}</List>')
})

test('what the module imports or declares, and globals, are not of the render', () => {
  const code = transform(`
import { format } from '@/format'
const UNIT = 'ms'
export default ({ value }) => <Output value={value}>{({ state }) => <b>{format(Number(state.value))} {UNIT}</b>}</Output>`)
  expect(code).toContain('const __constant_0 = ({ state }) => <b>{format(Number(state.value))} {UNIT}</b>;')
})
