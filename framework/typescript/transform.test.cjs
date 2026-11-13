// The TypeScript plugin's transform: the annotations it inserts must leave the file valid
// TypeScript, whatever the shape of the function they annotate.
const assert = require('node:assert/strict')
const { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { after, before, test } = require('node:test')
const ts = require('typescript')
const { createMapping, createTransformer } = require('./transform.cjs')

let root
let transformer

before(() => {
  root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'framework-transform-')))
  mkdirSync(path.join(root, 'clients', 'rest'), { recursive: true })
  mkdirSync(path.join(root, 'services', 'demo'), { recursive: true })
  writeFileSync(path.join(root, 'clients', 'rest', 'index.ts'), 'export default () => ({});\n')
  writeFileSync(
    path.join(root, 'services', 'demo', 'index.ts'),
    'export const list = () => () => Promise.resolve([]);\n',
  )
  mkdirSync(path.join(root, 'components', 'shaped'), { recursive: true })
  writeFileSync(
    path.join(root, 'components', 'shaped', 'render.tsx'),
    'export default ({ label }) => <p>{label}</p>;\n',
  )
  writeFileSync(
    path.join(root, 'components', 'shaped', 'props.ts'),
    'export default ({ className }) => ({ label: className });\n',
  )
  mkdirSync(path.join(root, 'components', 'plain'), { recursive: true })
  writeFileSync(
    path.join(root, 'components', 'plain', 'render.tsx'),
    'export default ({ className }) => <p className={className} />;\n',
  )
  transformer = createTransformer(ts, { root, runtime: 'framework' })
})

after(() => rmSync(root, { recursive: true, force: true }))

const transform = (relative, text) => transformer.transform(path.join(root, relative), text)

const syntaxErrors = (text, fileName = 'seen.ts') =>
  ts
    .transpileModule(text, { fileName, reportDiagnostics: true })
    .diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

test('a meta.ts whose default export takes one bare parameter gets parentheses around it', () => {
  const text = 'export default services => ({ save: { invalidates: [services.demo.list] } });\n'
  const seen = transform('services/demo/meta.ts', text).text
  assert.deepEqual(syntaxErrors(seen), [])
  assert.match(seen, /^export default \(services: .*Injection<.*>\): .*ServiceMeta<.*> => \(\{ save/)
})

test('a meta.ts whose body calls functions keeps its return type after the parameter list', () => {
  const text = 'export default ({ services }) => ({ save: { invalidates: [String(services)] } });\n'
  const seen = transform('services/demo/meta.ts', text).text
  assert.deepEqual(syntaxErrors(seen), [])
  assert.match(seen, /^export default \(\{ services \}: .*Injection<.*>\): .*ServiceMeta<.*> => \(\{ save/)
})

test('a meta.ts written as a function expression gets its return type after the parameter list', () => {
  const text = 'export default (function (injected) {\n  return { list: { reads: true } };\n});\n'
  const seen = transform('services/demo/meta.ts', text).text
  assert.deepEqual(syntaxErrors(seen), [])
  assert.match(seen, /^export default \(function \(injected: .*Injection<.*>\): .*ServiceMeta<.*> \{/)
})

test('a service operation that takes one bare parameter gets parentheses around it', () => {
  const text = 'export const list = injected => () => Promise.resolve(injected);\n'
  const seen = transform('services/demo/index.ts', text).text
  assert.deepEqual(syntaxErrors(seen), [])
  assert.match(seen, /^export const list = \(injected: .*Injection<.*>\) => \(\) =>/)
})

test('positions map back through the inserted parentheses', () => {
  const text = 'export default services => ({ save: { invalidates: [services.demo.list] } });\n'
  const { text: seen, insertions } = transform('services/demo/meta.ts', text)
  const mapping = createMapping(insertions)
  const original = text.indexOf('services.demo')
  assert.equal(seen.slice(mapping.toSeen(original)).startsWith('services.demo'), true)
  assert.equal(mapping.toOriginal(mapping.toSeen(original)), original)
  assert.equal(mapping.toOriginal(seen.indexOf('(services:')), text.indexOf('services =>'))
})

test('a render beside a props.ts gets what props.ts returns; props.ts gets what the render would have', () => {
  const render = transform('components/shaped/render.tsx', 'export default ({ label }) => <p>{label}</p>;\n').text
  const props = transform(
    'components/shaped/props.ts',
    'export default ({ className }) => ({ label: className });\n',
  ).text
  const plain = transform(
    'components/plain/render.tsx',
    'export default ({ className }) => <p className={className} />;\n',
  ).text
  assert.match(
    render,
    /\(\{ label \}: import\("framework"\)\.ShapedProps<typeof import\(".*\/components\/shaped\/props"\)>\)/,
  )
  assert.match(props, /\(\{ className \}: import\("framework"\)\.RenderProps<\{  \}>\)/)
  assert.match(plain, /RenderProps<\{  \}>/)
  assert.deepEqual(syntaxErrors(render, 'seen.tsx'), [])
})

test("an i18n.ts is read as const, so each message is its literal text", () => {
  const dir = path.join(root, 'components', 'plain')
  const file = path.join(dir, 'i18n.ts')
  const text = "export default {\n  title: 'Products',\n  found: '{count, plural, one {# product} other {# products}}',\n}\n"
  writeFileSync(file, text)
  const { text: seen, insertions } = transformer.transform(file, text)
  assert.equal(seen, "export default {\n  title: 'Products',\n  found: '{count, plural, one {# product} other {# products}}',\n} as const\n")
  assert.equal(insertions.length, 1)
  // Already read one way: left alone.
  const typed = "export default { title: 'Products' } as const\n"
  assert.equal(transformer.transform(file, typed).text, typed)
  rmSync(file)
})

test("a folder's messages reach its render, placeholder and error types", () => {
  const dir = path.join(root, 'components', 'plain')
  writeFileSync(path.join(dir, 'i18n.ts'), "export default { title: 'Products' }\n")
  writeFileSync(path.join(dir, 'placeholder.tsx'), 'export default ({ i18n }) => <p>{i18n.title}</p>;\n')
  const render = transformer.transform(path.join(dir, 'render.tsx'), 'export default ({ className }) => <p className={className} />;\n').text
  assert.match(render, /RenderProps<\{ i18n: typeof import\(".*components\/plain\/i18n"\) \}>/)
  const placeholder = transformer.transform(path.join(dir, 'placeholder.tsx'), 'export default ({ i18n }) => <p>{i18n.title}</p>;\n').text
  assert.match(placeholder, /PlaceholderProps<typeof import\(".*components\/plain\/i18n"\)>/)
  rmSync(path.join(dir, 'i18n.ts'))
  rmSync(path.join(dir, 'placeholder.tsx'))
})
