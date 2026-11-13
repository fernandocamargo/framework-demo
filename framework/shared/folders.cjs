// How the framework reads folders. Shared by the Vite plugin (plugin/index.mjs) and the
// TypeScript plugin (typescript/), so both agree on what is a component, a client or a service.
// CommonJS, because tsserver loads its plugins with `require`.
const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs')
const path = require('node:path')

const CODE = /\.(?:[cm]?[jt]sx?)$/
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/

const posix = (file) => file.split(path.sep).join('/')
const isDirectory = (file) => existsSync(file) && statSync(file).isDirectory()
const isCode = (entry) => CODE.test(entry) && !TEST.test(entry) && !entry.endsWith('.d.ts')
const stripExtension = (file) => file.replace(CODE, '')

/** The file that holds a layer: `<name>.<ext>`, or `<name>/index.<ext>` once the layer is a folder. */
function findLayer(dir, name) {
  if (!isDirectory(dir)) return null
  for (const entry of readdirSync(dir).sort()) {
    const file = path.join(dir, entry)
    if (entry === name && isDirectory(file)) {
      const index = readdirSync(file).find((child) => isCode(child) && stripExtension(child) === 'index')
      if (index) return path.join(file, index)
    }
    if (isCode(entry) && stripExtension(entry) === name) return file
  }
  return null
}

/** A folder below `root`, with a `render` layer and no `index`, is a component. */
const isComponentFolder = (root, dir) =>
  dir.startsWith(root + path.sep) && isDirectory(dir) && !findLayer(dir, 'index') && Boolean(findLayer(dir, 'render'))

function listComponentFolders(root) {
  const folders = []
  const visit = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const child = path.join(dir, entry)
      if (!isDirectory(child) || entry.startsWith('.')) continue
      if (isComponentFolder(root, child)) folders.push(child)
      visit(child)
    }
  }
  const components = path.join(root, 'components')
  if (isDirectory(components)) visit(components)
  return folders
}

/**
 * The `props` file of a component folder that states what a parent passes, as an exported type
 * named `Props`; null when the folder has none. The folder's declaration and the injected
 * types are both written from it, so a parent is checked against the module's interface.
 */
function declaredProps(dir) {
  const file = findLayer(dir, 'props')
  return file && /^export\s+(?:type|interface)\s+Props\b/m.test(readFileSync(file, 'utf8')) ? file : null
}

/** A component's identity: its folder's path from the root, such as `components/app`. */
const componentPath = (root, dir) => posix(path.relative(root, dir))

/** A folder name as a property name: `socket.io` → `socketIo`, `single-file` → `singleFile`. */
const camelCase = (segment) =>
  segment
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word.charAt(0).toLowerCase() : word.charAt(0).toUpperCase()) + word.slice(1))
    .join('')

/** CSS.escape, for the characters a folder path holds. */
const escapeIdentifier = (value) =>
  [...value]
    .map((character, index) => {
      if (/[A-Za-z_\u0080-￿-]/.test(character)) return character
      if (/[0-9]/.test(character)) return index === 0 ? `\\3${character} ` : character
      return `\\${character}`
    })
    .join('')

const selector = (value) => `.${escapeIdentifier(value)}`

/** `clients/<folder>/index.ts`, with an optional `meta.ts` beside it. */
function listClients(root) {
  const dir = path.join(root, 'clients')
  if (!isDirectory(dir)) return []
  return readdirSync(dir)
    .sort()
    .map((folder) => ({ folder, index: findLayer(path.join(dir, folder), 'index'), meta: findLayer(path.join(dir, folder), 'meta') }))
    .filter((client) => client.index)
}

/** The name services see a client under: `meta.ts`'s `exportAs` if it states one, its folder in camel case otherwise. */
function clientName(client) {
  if (client.meta) {
    const match = /exportAs\s*:\s*(['"`])([^'"`]+)\1/.exec(readFileSync(client.meta, 'utf8'))
    if (match) return match[2]
  }
  return camelCase(client.folder)
}

/** Every folder under `services/` with an `index`, at any depth. */
function listServices(root) {
  const dir = path.join(root, 'services')
  const services = []
  const visit = (folder, segments) => {
    const index = segments.length ? findLayer(folder, 'index') : null
    if (index) services.push({ segments, index })
    for (const entry of readdirSync(folder).sort()) {
      const child = path.join(folder, entry)
      if (isDirectory(child) && !entry.startsWith('.')) visit(child, [...segments, entry])
    }
  }
  if (isDirectory(dir)) visit(dir, [])
  return services
}

/** `style/skins/<name>/index.ts` (or `style/skins/<name>.ts`), each loaded on demand. */
function listSkins(dir) {
  const skins = path.join(dir, 'style', 'skins')
  if (!isDirectory(skins)) return []
  const names = new Set(
    readdirSync(skins)
      .filter((entry) => isDirectory(path.join(skins, entry)) || isCode(entry))
      .map(stripExtension),
  )
  return [...names]
    .sort()
    .map((name) => ({ name, file: findLayer(skins, name) }))
    .filter((skin) => skin.file)
}

const LAYER_NAMES = ['render', 'props', 'async', 'state', 'form', 'placeholder', 'error']
/** The layer files that render, where the Vite plugin tracks every `on…` handler. */
const RENDERING_LAYERS = ['render', 'placeholder', 'error']
const JSX_FILE = /\.[jt]sx$/

/** TypeScript, the project's own if it has one, for the checks that read source. Loaded on first use. */
let typescript
const typescriptFor = (root) => {
  if (!typescript) {
    let resolved
    try {
      resolved = require.resolve('typescript', { paths: [root] })
    } catch {
      resolved = require.resolve('typescript')
    }
    typescript = require(resolved)
  }
  return typescript
}

/**
 * What makes a rendering layer file hold more than one component: JSX outside its default
 * export, or an element whose tag is a component declared in the file itself. Each as
 * `{ line, what }`.
 */
function secondComponents(root, file) {
  const ts = typescriptFor(root)
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
  const isJsx = (node) => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)
  const hasJsx = (node) => isJsx(node) || Boolean(ts.forEachChild(node, (child) => hasJsx(child) || undefined))
  const modifiers = (node) => (ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [])
  const isDefault = (node) => modifiers(node).some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
  const nameOf = (statement) =>
    statement.name?.text ??
    statement.declarationList?.declarations.map((declaration) => declaration.name.getText(source)).join(', ')

  // `export default View`, with `View` declared above, makes that declaration the component.
  const exported = source.statements.find((statement) => ts.isExportAssignment(statement) && !statement.isExportEquals)
  const exportedName = exported && ts.isIdentifier(exported.expression) ? exported.expression.text : null
  const isTheComponent = (statement) =>
    statement === exported ||
    ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && isDefault(statement)) ||
    (exportedName !== null && nameOf(statement)?.split(', ').includes(exportedName))

  const found = []
  for (const statement of source.statements)
    if (!isTheComponent(statement) && hasJsx(statement))
      found.push({
        line: line(statement),
        what: `JSX outside the default export (${nameOf(statement) ?? 'a statement'})`,
      })

  // A declaration that defines a component: a function or class, or a call that wraps one
  // (`memo(() => …)`). An alias (`const Icon = open ? Up : Down`) renders an imported component.
  const functionLike = (node) =>
    node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isClassExpression(node))
  const definesComponent = (node) =>
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    (ts.isVariableDeclaration(node) &&
      (functionLike(node.initializer) ||
        (node.initializer && ts.isCallExpression(node.initializer) && node.initializer.arguments.some(functionLike))))
  const declared = new Set()
  const collect = (node) => {
    if (
      definesComponent(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      /^[A-Z]/.test(node.name.text) &&
      node.name.text !== exportedName
    )
      declared.add(node.name.text)
    ts.forEachChild(node, collect)
  }
  collect(source)
  const tags = (node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName))
      if (declared.has(node.tagName.text))
        found.push({ line: line(node), what: `<${node.tagName.text}>, a component declared in this file` })
    ts.forEachChild(node, tags)
  }
  tags(source)
  return found
}


/**
 * The convention mistakes that would otherwise fail silently or far from their cause:
 * each names the file and the rule. The Vite plugin shows them as warnings; `npm run typecheck`
 * (typescript/check.cjs) fails on them, since agents run the type check.
 */
function problems(root) {
  const found = []
  const relative = (file) => posix(path.relative(root, file))
  const visit = (dir, check) => {
    if (!isDirectory(dir)) return
    for (const entry of readdirSync(dir).sort()) {
      const child = path.join(dir, entry)
      if (isDirectory(child) && !entry.startsWith('.')) {
        check(child)
        visit(child, check)
      }
    }
  }

  visit(path.join(root, 'components'), (dir) => {
    if (path.basename(dir) === 'style' || dir.includes(`${path.sep}style${path.sep}`)) return
    const entries = readdirSync(dir).filter(isCode)
    for (const entry of entries) {
      const base = stripExtension(entry)
      const layer = LAYER_NAMES.find((name) => name === base.toLowerCase())
      if (layer && base !== layer) found.push({ file: relative(path.join(dir, entry)), message: `rename to ${layer}${entry.slice(base.length)}: layer files are lower case` })
    }
    const render = findLayer(dir, 'render')
    const index = findLayer(dir, 'index')
    if (render && index) found.push({ file: relative(dir), message: 'has both render and index: a folder with an index is left alone, so its render is not used' })
    const layers = LAYER_NAMES.filter((name) => name !== 'render' && findLayer(dir, name))
    if (!render && !index && layers.length) found.push({ file: relative(dir), message: `has ${layers.map((name) => `${name}.*`).join(', ')} but no render.tsx, so it is not a component` })
  })

  visit(path.join(root, 'services'), (dir) => {
    const meta = findLayer(dir, 'meta')
    if (meta && !findLayer(dir, 'index')) found.push({ file: relative(meta), message: 'describes no service: there is no index beside it' })
  })

  const clients = path.join(root, 'clients')
  if (isDirectory(clients)) {
    for (const entry of readdirSync(clients).sort()) {
      const dir = path.join(clients, entry)
      if (isDirectory(dir) && !findLayer(dir, 'index')) found.push({ file: relative(dir), message: 'is not a client: it has no index' })
    }
  }

  // Every component is a component folder's render, so the plugin tracks every handler: JSX
  // lives only in a component folder's render.tsx, placeholder.tsx and error.tsx, and each of
  // those holds one component, its default export.
  const files = (dir) =>
    !isDirectory(dir)
      ? []
      : readdirSync(dir)
          .sort()
          .filter((entry) => !entry.startsWith('.'))
          .flatMap((entry) => {
            const child = path.join(dir, entry)
            return isDirectory(child) ? files(child) : isCode(entry) ? [child] : []
          })
  for (const file of ['components', 'services', 'clients'].flatMap((layer) => files(path.join(root, layer)))) {
    if (!JSX_FILE.test(file)) continue
    const rendering = RENDERING_LAYERS.includes(stripExtension(path.basename(file)))
    if (!rendering || !isComponentFolder(root, path.dirname(file))) {
      found.push({
        file: relative(file),
        message:
          "holds JSX outside a component folder's render, placeholder or error, where handlers are not tracked: give each component in it a folder of its own, with a render.tsx",
      })
      continue
    }
    for (const { line, what } of secondComponents(root, file))
      found.push({
        file: `${relative(file)}:${line}`,
        message: `holds a second component, ${what}: one component per file, so give it a folder of its own, with a render.tsx`,
      })
  }
  return found
}

module.exports = {
  problems,
  CODE,
  posix,
  isDirectory,
  isCode,
  stripExtension,
  findLayer,
  isComponentFolder,
  listComponentFolders,
  declaredProps,
  componentPath,
  camelCase,
  escapeIdentifier,
  selector,
  listClients,
  clientName,
  listServices,
  listSkins,
}
