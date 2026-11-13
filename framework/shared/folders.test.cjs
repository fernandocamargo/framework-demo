// The convention checks: every component is a component folder's render (or placeholder, or
// error), one component per file, so the plugin tracks every handler.
const assert = require('node:assert/strict')
const { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { after, before, test } = require('node:test')
const { declaredProps, problems } = require('./folders.cjs')

let root
const write = (relative, text) => {
  const file = path.join(root, relative)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}
const about = (prefix) => problems(root).filter((problem) => problem.file.startsWith(prefix))

before(() => {
  root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'framework-folders-')))
  write(
    'components/clean/render.tsx',
    'export default ({ items }) => <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>;\n',
  )
  write('components/clean/placeholder.tsx', 'export default () => <p>Loading</p>;\n')
  write('components/named/render.tsx', 'const View = () => <div />;\nexport default View;\n')
  write(
    'components/alias/render.tsx',
    "import { Up, Down } from 'icons';\nexport default ({ open }) => {\n  const Icon = open ? Up : Down;\n  return <Icon />;\n};\n",
  )
  write(
    'components/second/render.tsx',
    'const Row = () => <tr />;\nexport default () => (\n  <table>\n    <Row />\n  </table>\n);\n',
  )
  write('components/nested/render.tsx', 'export default () => {\n  const Row = () => <tr />;\n  return <Row />;\n};\n')
  write(
    'components/helper/render.tsx',
    'const cell = (value) => <td>{value}</td>;\nexport default () => <tr>{cell(1)}</tr>;\n',
  )
  write('components/cells.tsx', 'export const Cell = () => <td />;\n')
  write('components/folder/render/index.tsx', 'export default () => <div />;\n')
  write('services/demo/index.tsx', 'export const list = () => () => Promise.resolve(<div />);\n')
  write('services/demo/types.ts', 'export type Item = { id: string };\n')
})

after(() => rmSync(root, { recursive: true, force: true }))

test('a component folder whose rendering files each hold one component passes', () => {
  assert.deepEqual(about('components/clean'), [])
  assert.deepEqual(about('components/named'), [])
  assert.deepEqual(about('components/alias'), [])
})

test('a second component beside the default export is named, with its line', () => {
  const found = about('components/second')
  assert.deepEqual(
    found.map((problem) => problem.file),
    ['components/second/render.tsx:1', 'components/second/render.tsx:4'],
  )
  assert.match(found[0].message, /JSX outside the default export \(Row\)/)
  assert.match(found[1].message, /<Row>, a component declared in this file/)
})

test('a component declared inside the render, and rendered, is a second component', () => {
  assert.deepEqual(
    about('components/nested').map((problem) => problem.file),
    ['components/nested/render.tsx:3'],
  )
})

test('JSX in a helper outside the default export is named too', () => {
  assert.deepEqual(
    about('components/helper').map((problem) => problem.file),
    ['components/helper/render.tsx:1'],
  )
})

test('JSX outside a component folder, or in a render grown into a folder, is named', () => {
  assert.deepEqual(about('components/cells.tsx').length, 1)
  assert.match(about('components/cells.tsx')[0].message, /handlers are not tracked/)
  assert.deepEqual(about('components/folder/render').length, 1)
  assert.deepEqual(
    about('services/demo').map((problem) => problem.file),
    ['services/demo/index.tsx'],
  )
})

test('a props file that exports a type named Props states what a parent passes', () => {
  write('components/typed/render.tsx', 'export default ({ label }) => <p>{label}</p>;\n')
  write('components/typed/props.ts', 'export type Props = { label: string }\nexport default ({ label }) => ({ label });\n')
  write('components/untyped/render.tsx', 'export default ({ label }) => <p>{label}</p>;\n')
  write('components/untyped/props.ts', 'type Props = { label: string }\nexport default ({ label }: Props) => ({ label });\n')
  assert.equal(declaredProps(path.join(root, 'components/typed')), path.join(root, 'components/typed/props.ts'))
  assert.equal(declaredProps(path.join(root, 'components/untyped')), null)
  assert.equal(declaredProps(path.join(root, 'components/clean')), null)
})
