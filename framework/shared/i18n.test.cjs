// The i18n checks: a folder's translations must say what its i18n.ts says, key for key and
// argument for argument, and what a component's files read decides what it follows.
const assert = require('node:assert/strict')
const { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { after, before, test } = require('node:test')
const { i18nProblems, messagesOf, readsOf } = require('./folders.cjs')

let root
const write = (relative, text) => {
  const file = path.join(root, relative)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, typeof text === 'string' ? text : JSON.stringify(text))
}
const dir = (name) => path.join(root, 'components', name)
const messages = (name) => i18nProblems(root, dir(name)).map((problem) => problem.message)

before(() => {
  root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'framework-i18n-')))
  const source = [
    'export default {',
    "  title: 'Products',",
    "  found: '{count, plural, one {# product} other {# products}}',",
    "  empty: { actions: { clear: 'Clear the <b>filters</b>' } },",
    '  computed: (values) => String(values),',
    '}',
    '',
  ].join('\n')
  for (const name of ['good', 'bad']) {
    write(`components/${name}/render.tsx`, 'export default () => <p />;\n')
    write(`components/${name}/i18n.ts`, source)
  }
  write('components/good/i18n/pt-BR.json', {
    'components/good/title': 'Produtos',
    'components/good/found': '{count, plural, one {# produto} other {# produtos}}',
    'components/good/empty/actions/clear': 'Limpar os <b>filtros</b>',
  })
  write('components/bad/i18n/pt-BR.json', {
    'components/bad/title': 'Produtos',
    'components/bad/found': '{total, plural, one {# produto} other {# produtos}}',
    'components/bad/empty/actions/clear': 'Limpar os filtros {now}',
    'components/bad/subtitle': 'Sobra',
    'components/bad/computed': 'Calculada',
  })
  write('components/broken/render.tsx', 'export default () => <p />;\n')
  write('components/broken/i18n.ts', "const messages = { title: 'x' }\nexport default messages\n")
  write('components/stray/render.tsx', 'export default () => <p />;\n')
  write('components/stray/i18n/pt-BR.json', {})

  write('components/reads/render.tsx', 'export default ({ label }) => <p>{label}</p>;\n')
  write(
    'components/reads/props.ts',
    'export const half = (value) => value / 2;\nexport default ({ intl, async: { default: page } }) => ({ label: intl.formatNumber(half(page)) });\n',
  )
  write('components/reads/async.ts', 'export default ({ services, locale }) => services.page(locale);\n')
  write('components/reads/state.ts', 'export const allowed = ({ acl }) => acl.allowed;\nexport default ({ services }) => ({ idle: {} });\n')
  write('components/everything/render.tsx', 'export default (props) => <p>{props.label}</p>;\n')
})

after(() => rmSync(root, { recursive: true, force: true }))

test("messages are read from i18n.ts without running it, at any depth, functions marked", () => {
  const { leaves, issues } = messagesOf(root, path.join(dir('good'), 'i18n.ts'))
  assert.deepEqual(issues, [])
  assert.deepEqual([...leaves], [
    ['title', 'Products'],
    ['found', '{count, plural, one {# product} other {# products}}'],
    ['empty/actions/clear', 'Clear the <b>filters</b>'],
    ['computed', null],
  ])
})

test('a translation that says what i18n.ts says passes', () => {
  assert.deepEqual(messages('good'), [])
})

test('a translation that loses or adds arguments or tags, names unknown messages or misses one is named', () => {
  assert.deepEqual(messages('bad').sort(), [
    '"components/bad/computed" translates a function, which is not translated',
    '"components/bad/empty/actions/clear" adds {now}, which i18n.ts does not pass',
    '"components/bad/empty/actions/clear" loses <b>',
    '"components/bad/found" adds {total}, which i18n.ts does not pass',
    '"components/bad/found" loses {count}',
    '"components/bad/subtitle" names a message i18n.ts does not have',
  ])
})

test('an i18n.ts that is not an object literal, and translations with no i18n.ts, are named', () => {
  assert.deepEqual(messages('broken'), ['default-exports no object literal of messages'])
  assert.deepEqual(messages('stray'), ['holds translations, but the folder has no i18n.ts'])
})

test('a missing translation is named with its key and locale', () => {
  write('components/missing/render.tsx', 'export default () => <p />;\n')
  write('components/missing/i18n.ts', "export default { title: 'Products', subtitle: 'All of them' }\n")
  write('components/missing/i18n/pt-BR.json', { 'components/missing/title': 'Produtos' })
  assert.deepEqual(messages('missing'), ['misses "components/missing/subtitle" (pt-BR)'])
})

test('what a component reads is what its files destructure, file by file', () => {
  assert.deepEqual(readsOf(root, dir('reads')), {
    all: ['intl', 'locale', 'acl'],
    byLayer: { props: ['intl'], async: ['locale'], state: ['acl'] },
    names: { props: ['async', 'intl'], async: ['locale', 'services'], chart: ['services'], state: ['acl', 'services'] },
  })
  // props.ts's own helper (`half`) is not called by the framework, so its parameter reads nothing.
  // A parameter that is not destructured may read anything.
  assert.deepEqual(readsOf(root, dir('everything')).all, ['intl', 'locale', 'i18n', 'user', 'acl', 'flags', 'route', 'keyboard'])
})
