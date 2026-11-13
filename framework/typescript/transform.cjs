// Types the arguments the framework injects:
// TypeScript sees each layer file with a type annotation inserted on the first parameter of
// the functions the framework calls. The source on disk never changes. The annotation is
// inserted inside one line, so every other line keeps its position.
//
// Shared by the tsserver plugin (index.cjs, for editors) and the command-line check (check.cjs).
//
// | File                                   | Functions annotated                   | Type                       |
// |----------------------------------------|---------------------------------------|----------------------------|
// | `components/…/render`                  | the default export                    | `RenderProps<async.ts>`, or `ShapedProps<props.ts>` |
// | `components/…/props`                   | the default export                    | `RenderProps<async.ts>`, with the file's own `Props` as what a parent passes |
// | `components/…/async`                   | the default and every named export    | `AsyncInjection<…>`        |
// | `components/…/placeholder`, `…/error`  | the default export                    | `PlaceholderProps`, `ErrorProps` |
// | `components/…/state`                   | the default export                    | `Injection<…>`             |
// |                                        | every exported function (checks, changes) | `StateArgs<…>`         |
// | `services/**/index`                    | the default and every named export    | `Injection<…>`             |
// | `services/**/meta`                     | the default export, and what it returns | `Injection<…>`, `ServiceMeta<…>` |
// | `clients/*/index`                      | the default export                    | `ClientInjection`          |
// | `components/…/i18n`                    | its default export is read `as const`, so each message is its literal text, typed from its ICU |
// | `components/…/acl`                     | the default export                    | what props.ts gets (`RenderProps`) |
//
// `Injection` and `AsyncInjection` carry this app's clients and services, written as a type
// from the folders: `{ rest: ReturnType<typeof import("…/clients/rest/index").default> }`, and
// `ServiceNode<typeof import("…/services/single-file/index")>` for each service.
const path = require('node:path')
const folders = require('../shared/folders.cjs')

const LAYERS = new Set(['render', 'props', 'async', 'placeholder', 'error', 'state', 'i18n', 'acl'])

/**
 * @param {typeof import('typescript')} ts
 * @param {{ root: string, runtime?: string }} options `root`: the framework's root folder, absolute.
 */
function createTransformer(ts, { root, runtime = 'framework' }) {
  const types = `import(${JSON.stringify(runtime)})`
  const moduleType = (file) => `typeof import(${JSON.stringify(folders.posix(folders.stripExtension(file)))})`

  /** What the framework calls in this file, or null when it calls nothing. */
  function kind(fileName) {
    const file = path.normalize(fileName)
    if (!file.startsWith(root + path.sep) || file.includes(`${path.sep}node_modules${path.sep}`) || !folders.CODE.test(file)) return null
    const parts = folders.posix(path.relative(root, file)).split('/')
    const base = folders.stripExtension(parts[parts.length - 1])
    if (parts[0] === 'clients' && parts.length === 3 && base === 'index') return { name: 'client' }
    if (parts[0] === 'services' && parts.length >= 3 && base === 'index') return { name: 'service' }
    if (parts[0] === 'services' && parts.length >= 3 && base === 'meta') return { name: 'serviceMeta' }
    if (parts[0] !== 'components') return null
    // A layer is `<layer>.<ext>` in a component folder, or `<layer>/index.<ext>`.
    const candidates = [
      { dir: path.dirname(file), layer: base },
      { dir: path.dirname(path.dirname(file)), layer: path.basename(path.dirname(file)), folder: true },
    ]
    for (const { dir, layer, folder } of candidates) {
      if (folder && base !== 'index') continue
      if (LAYERS.has(layer) && folders.isComponentFolder(root, dir)) return { name: layer, dir }
    }
    return null
  }

  // The clients' and services' types change only when files are added or removed, so the
  // listing is kept for a moment: tsserver asks for versions often.
  let listing = { at: 0, value: null }
  function trees() {
    const now = Date.now()
    if (listing.value && now - listing.at < 1000) return listing.value

    // `[name, module]` and `[path, module]` entries; the runtime's types build the trees from
    // them, so hovers show the clients and operations, not this text.
    const entry = (name, file) => `[${JSON.stringify(name)}, ${moduleType(file)}]`
    const union = (entries) => (entries.length ? entries.join(' | ') : 'never')
    const clients = folders.listClients(root).map((client) => entry(folders.clientName(client), client.index))
    const services = folders.listServices(root).map((service) => entry(service.segments.map(folders.camelCase).join('.'), service.index))

    const value = {
      clients: `${types}.Clients<${union(clients)}>`,
      services: `${types}.ServiceTree<${union(services)}>`,
    }
    value.signature = String(hash(value.clients + value.services))
    listing = { at: now, value }
    return value
  }

  /** Whether a module exports a type named `Events` (the payloads of a chart's events). */
  const exportsEvents = (file) => {
    const source = ts.createSourceFile(file, ts.sys.readFile(file) ?? '', ts.ScriptTarget.Latest, true)
    return source.statements.some(
      (statement) => (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) && statement.name.text === 'Events' && exported(statement),
    )
  }
  const typeImport = (file) => `import(${JSON.stringify(folders.posix(folders.stripExtension(file)))})`

  function annotation(found, named) {
    const { clients, services } = trees()
    switch (found.name) {
      case 'render':
      case 'props':
      // acl.ts gets what props.ts gets, with the route and the `acl` inherited from above.
      case 'acl': {
        // With a props.ts, the render gets what it returns; props.ts gets what the render would have.
        const shaping = folders.findLayer(found.dir, 'props')
        if (found.name === 'render' && shaping) return `${types}.ShapedProps<${moduleType(shaping)}>`
        const layers = []
        const async = folders.findLayer(found.dir, 'async')
        const state = folders.findLayer(found.dir, 'state')
        const form = folders.findLayer(found.dir, 'form')
        if (async) layers.push(`async: ${moduleType(async)}`)
        if (state) layers.push(`state: ${moduleType(state)}`, `events: ${exportsEvents(state) ? `${typeImport(state)}.Events` : 'object'}`)
        if (form) layers.push(`form: ${moduleType(form)}`)
        const i18n = folders.findLayer(found.dir, 'i18n')
        if (i18n) layers.push(`i18n: ${moduleType(i18n)}`)
        // What a parent passes, when props.ts states it (`export type Props`).
        const passed = folders.declaredProps(found.dir)
        if (passed) layers.push(`passed: ${typeImport(passed)}.Props`)
        return `${types}.RenderProps<{ ${layers.join('; ')} }>`
      }
      case 'state': {
        if (!named) return `${types}.Injection<${clients}, ${services}>`
        const file = folders.findLayer(found.dir, 'state')
        const form = folders.findLayer(found.dir, 'form')
        const i18n = folders.findLayer(found.dir, 'i18n')
        return `${types}.StateArgs<${clients}, ${services}, ${moduleType(file)}, ${exportsEvents(file) ? `${typeImport(file)}.Events` : 'object'}, ${form ? moduleType(form) : 'undefined'}, ${i18n ? moduleType(i18n) : 'undefined'}>`
      }
      case 'async':
        return `${types}.AsyncInjection<${clients}, ${services}>`
      case 'service':
      case 'serviceMeta':
        return `${types}.Injection<${clients}, ${services}>`
      case 'client':
        return `${types}.ClientInjection`
      case 'placeholder':
      case 'error': {
        const i18n = folders.findLayer(found.dir, 'i18n')
        return `${types}.${found.name === 'error' ? 'ErrorProps' : 'PlaceholderProps'}${i18n ? `<${moduleType(i18n)}>` : ''}`
      }
      default:
        return null
    }
  }

  const exported = (node) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  const isDefault = (node) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
  const isFunction = (node) => node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node))

  /**
   * An arrow function's one parameter written without parentheses (`services => …`), or nothing.
   * Annotations on it need parentheses around it: `services: T => …` is not TypeScript.
   */
  const bareParameter = (fn, source) =>
    ts.isArrowFunction(fn) && !fn.getChildren(source).some((child) => child.kind === ts.SyntaxKind.OpenParenToken)
      ? { start: fn.parameters[0].getStart(source), end: fn.parameters[0].end }
      : undefined

  /** Where annotations go: after the first parameter's name of each function the framework calls. */
  function points(text, fileName, named) {
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true)
    const functions = []
    for (const statement of source.statements) {
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        let expression = statement.expression
        while (ts.isParenthesizedExpression(expression)) expression = expression.expression
        if (isFunction(expression)) functions.push({ fn: expression, named: false })
      } else if (ts.isFunctionDeclaration(statement) && exported(statement) && (named || isDefault(statement))) {
        functions.push({ fn: statement, named: !isDefault(statement) })
      } else if (named && ts.isVariableStatement(statement) && exported(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (isFunction(declaration.initializer)) functions.push({ fn: declaration.initializer, named: true })
        }
      }
    }
    return functions
      .map(({ fn, named: isNamed }) => ({ fn, parameter: fn.parameters[0], named: isNamed }))
      .filter(({ parameter }) => parameter && !parameter.type && !parameter.dotDotDotToken)
      .map(({ fn, parameter, named: isNamed }) => ({
        at: (parameter.questionToken ?? parameter.name).end,
        named: isNamed,
        bare: bareParameter(fn, source),
      }))
  }

  /**
   * Where a service `meta.ts`'s default export says what it returns: after its parameter list.
   * Its rules are then checked against the service's exports, so a mistyped operation name is
   * reported instead of leaving a read uncached.
   */
  function returnPoints(text, fileName) {
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true)
    const out = []
    for (const statement of source.statements) {
      if (!ts.isExportAssignment(statement) || statement.isExportEquals) continue
      let expression = statement.expression
      while (ts.isParenthesizedExpression(expression)) expression = expression.expression
      if (!isFunction(expression) || expression.type) continue
      // The parameter list's own closing parenthesis, as a token: a search of the text would find
      // one in the body when the list has none (`services => ({ … })`).
      const bare = bareParameter(expression, source)
      const close = expression.getChildren(source).find((child) => child.kind === ts.SyntaxKind.CloseParenToken)
      if (bare) out.push({ at: bare.end, returns: true, bare })
      else if (close) out.push({ at: close.end, returns: true })
    }
    return out
  }

  /**
   * Where an `i18n.ts` gets ` as const`: after its default-exported object, unless it already
   * says how to read it (`as const`, `satisfies`).
   */
  function constPoints(text, fileName) {
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true)
    const exported = source.statements.find((statement) => ts.isExportAssignment(statement) && !statement.isExportEquals)
    if (!exported) return []
    let expression = exported.expression
    while (ts.isParenthesizedExpression(expression)) expression = expression.expression
    if (!ts.isObjectLiteralExpression(expression)) return []
    return [{ at: exported.expression.end, constant: true }]
  }

  return {
    /** Whether the framework injects into this file. */
    isLayer: (fileName) => kind(fileName) !== null,

    /** Changes when the annotation's text would change for reasons outside the file. */
    signature(fileName) {
      const found = kind(fileName)
      if (!found) return ''
      const layers = found.dir ? ['props', 'async', 'state', 'form', 'i18n', 'acl'].map((name) => folders.findLayer(found.dir, name) ?? '').join(',') : ''
      return `${trees().signature}:${layers}:${found.dir && folders.declaredProps(found.dir) ? 'typed' : ''}`
    },

    /**
     * The file as TypeScript should see it, and where text was inserted: `[{ at, length }]`,
     * `at` in the original text, in order. `createMapping` turns positions between the two.
     */
    transform(fileName, text) {
      const found = kind(fileName)
      if (!found) return { text, insertions: [] }
      const named = found.name === 'async' || found.name === 'service' || found.name === 'state'
      const found_points = (
        found.name === 'i18n' ? constPoints(text, fileName) : [...points(text, fileName, named), ...(found.name === 'serviceMeta' ? returnPoints(text, fileName) : [])]
      ).sort((a, b) => a.at - b.at)
      // What goes where. At one position: the parameter's annotation, then the parenthesis that
      // closes a bare parameter, then the return type.
      const edits = new Map()
      const add = (at, order, inserted) => edits.set(`${at}:${order}`, { at, order, inserted })
      for (const point of found_points) {
        if (point.constant) {
          add(point.at, 0, ' as const')
          continue
        }
        const index = point.returns ? folders.findLayer(path.dirname(fileName), 'index') : null
        const type = point.returns ? (index ? `${types}.ServiceMeta<${moduleType(index)}>` : null) : annotation(found, point.named)
        if (!type) continue
        add(point.at, point.returns ? 2 : 0, `: ${type}`)
        if (point.bare) {
          add(point.bare.start, -1, '(')
          add(point.bare.end, 1, ')')
        }
      }
      const insertions = []
      let output = ''
      let from = 0
      for (const { at, inserted } of [...edits.values()].sort((a, b) => a.at - b.at || a.order - b.order)) {
        output += text.slice(from, at) + inserted
        from = at
        const last = insertions[insertions.length - 1]
        if (last?.at === at) last.length += inserted.length
        else insertions.push({ at, length: inserted.length })
      }
      return { text: output + text.slice(from), insertions }
    },
  }
}

/**
 * Positions between a file's original text and the text TypeScript sees. A position inside an
 * inserted annotation maps to where the annotation was inserted.
 */
function createMapping(insertions) {
  return {
    /** An original position, in the text TypeScript sees. */
    toSeen(position) {
      let shift = 0
      for (const { at, length } of insertions) {
        if (at <= position) shift += length
        else break
      }
      return position + shift
    },
    /** A position in the text TypeScript sees, in the original. */
    toOriginal(position) {
      let shift = 0
      for (const { at, length } of insertions) {
        const start = at + shift
        if (position < start) break
        if (position < start + length) return at
        shift += length
      }
      return position - shift
    },
  }
}

function hash(text) {
  let value = 0
  for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) | 0
  return value >>> 0
}

module.exports = { createTransformer, createMapping }
