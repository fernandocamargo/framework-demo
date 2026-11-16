// How the framework reads folders. Shared by the Vite plugin (plugin/index.mjs) and the
// TypeScript plugin (typescript/), so both agree on what is a component, a client or a service.
// CommonJS, because tsserver loads its plugins with `require`.
const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');

const CODE = /\.(?:[cm]?[jt]sx?)$/;
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

const posix = (file) => file.split(path.sep).join('/');
const isDirectory = (file) => existsSync(file) && statSync(file).isDirectory();
const isCode = (entry) => CODE.test(entry) && !TEST.test(entry) && !entry.endsWith('.d.ts');
const stripExtension = (file) => file.replace(CODE, '');

/** The file that holds a layer: `<name>.<ext>`, or `<name>/index.<ext>` once the layer is a folder. */
function findLayer(dir, name) {
  if (!isDirectory(dir)) return null;
  for (const entry of readdirSync(dir).sort()) {
    const file = path.join(dir, entry);
    if (entry === name && isDirectory(file)) {
      const index = readdirSync(file).find((child) => isCode(child) && stripExtension(child) === 'index');
      if (index) return path.join(file, index);
    }
    if (isCode(entry) && stripExtension(entry) === name) return file;
  }
  return null;
}

/** A folder below `root`, with a `render` layer and no `index`, is a component. */
const isComponentFolder = (root, dir) =>
  dir.startsWith(root + path.sep) && isDirectory(dir) && !findLayer(dir, 'index') && Boolean(findLayer(dir, 'render'));

function listComponentFolders(root) {
  const folders = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const child = path.join(dir, entry);
      if (!isDirectory(child) || entry.startsWith('.')) continue;
      if (isComponentFolder(root, child)) folders.push(child);
      visit(child);
    }
  };
  const components = path.join(root, 'components');
  if (isDirectory(components)) visit(components);
  return folders;
}

/**
 * The `props` file of a component folder that states what a parent passes, as an exported type
 * named `Props`; null when the folder has none. The folder's declaration and the injected
 * types are both written from it, so a parent is checked against the module's interface.
 */
function declaredProps(dir) {
  const file = findLayer(dir, 'props');
  return file && /^export\s+(?:type|interface)\s+Props\b/m.test(readFileSync(file, 'utf8')) ? file : null;
}

/** A component's identity: its folder's path from the root, such as `components/app`. */
const componentPath = (root, dir) => posix(path.relative(root, dir));

/** A folder name as a property name: `socket.io` → `socketIo`, `single-file` → `singleFile`. */
const camelCase = (segment) =>
  segment
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word.charAt(0).toLowerCase() : word.charAt(0).toUpperCase()) + word.slice(1))
    .join('');

/** CSS.escape, for the characters a folder path holds. */
const escapeIdentifier = (value) =>
  [...value]
    .map((character, index) => {
      if (/[A-Za-z_\u0080-￿-]/.test(character)) return character;
      if (/[0-9]/.test(character)) return index === 0 ? `\\3${character} ` : character;
      return `\\${character}`;
    })
    .join('');

const selector = (value) => `.${escapeIdentifier(value)}`;

/** `clients/<folder>/index.ts`, with an optional `meta.ts` beside it. */
function listClients(root) {
  const dir = path.join(root, 'clients');
  if (!isDirectory(dir)) return [];
  return readdirSync(dir)
    .sort()
    .map((folder) => ({
      folder,
      index: findLayer(path.join(dir, folder), 'index'),
      meta: findLayer(path.join(dir, folder), 'meta'),
    }))
    .filter((client) => client.index);
}

/** The name services see a client under: `meta.ts`'s `exportAs` if it states one, its folder in camel case otherwise. */
function clientName(client) {
  if (client.meta) {
    const match = /exportAs\s*:\s*(['"`])([^'"`]+)\1/.exec(readFileSync(client.meta, 'utf8'));
    if (match) return match[2];
  }
  return camelCase(client.folder);
}

/** Every folder under `services/` with an `index`, at any depth. */
function listServices(root) {
  const dir = path.join(root, 'services');
  const services = [];
  const visit = (folder, segments) => {
    const index = segments.length ? findLayer(folder, 'index') : null;
    if (index) services.push({ index, segments });
    for (const entry of readdirSync(folder).sort()) {
      const child = path.join(folder, entry);
      if (isDirectory(child) && !entry.startsWith('.')) visit(child, [...segments, entry]);
    }
  };
  if (isDirectory(dir)) visit(dir, []);
  return services;
}

/** `style/skins/<name>/index.ts` (or `style/skins/<name>.ts`), each loaded on demand. */
function listSkins(dir) {
  const skins = path.join(dir, 'style', 'skins');
  if (!isDirectory(skins)) return [];
  const names = new Set(
    readdirSync(skins)
      .filter((entry) => isDirectory(path.join(skins, entry)) || isCode(entry))
      .map(stripExtension),
  );
  return [...names]
    .sort()
    .map((name) => ({ file: findLayer(skins, name), name }))
    .filter((skin) => skin.file);
}

const LAYER_NAMES = [
  'render',
  'props',
  'async',
  'state',
  'form',
  'handlers',
  'placeholder',
  'error',
  'i18n',
  'acl',
  'shortcuts',
];
/** The layer files that render, where the Vite plugin tracks every `on…` handler. */
const RENDERING_LAYERS = ['render', 'placeholder', 'error'];
const JSX_FILE = /\.[jt]sx$/;

/** TypeScript, the project's own if it has one, for the checks that read source. Loaded on first use. */
let typescript;
const typescriptFor = (root) => {
  if (!typescript) {
    let resolved;
    try {
      resolved = require.resolve('typescript', { paths: [root] });
    } catch {
      resolved = require.resolve('typescript');
    }
    typescript = require(resolved);
  }
  return typescript;
};

/**
 * What makes a rendering layer file hold more than one component: JSX outside its default
 * export, or an element whose tag is a component declared in the file itself. Each as
 * `{ line, what }`.
 */
function secondComponents(root, file) {
  const ts = typescriptFor(root);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const isJsx = (node) => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
  const hasJsx = (node) => isJsx(node) || Boolean(ts.forEachChild(node, (child) => hasJsx(child) || undefined));
  const modifiers = (node) => (ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : []);
  const isDefault = (node) => modifiers(node).some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
  const nameOf = (statement) =>
    statement.name?.text ??
    statement.declarationList?.declarations.map((declaration) => declaration.name.getText(source)).join(', ');

  // `export default View`, with `View` declared above, makes that declaration the component.
  const exported = source.statements.find((statement) => ts.isExportAssignment(statement) && !statement.isExportEquals);
  const exportedName = exported && ts.isIdentifier(exported.expression) ? exported.expression.text : null;
  const isTheComponent = (statement) =>
    statement === exported ||
    ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && isDefault(statement)) ||
    (exportedName !== null && nameOf(statement)?.split(', ').includes(exportedName));

  const found = [];
  for (const statement of source.statements)
    if (!isTheComponent(statement) && hasJsx(statement))
      found.push({
        line: line(statement),
        what: `JSX outside the default export (${nameOf(statement) ?? 'a statement'})`,
      });

  // A declaration that defines a component: a function or class, or a call that wraps one
  // (`memo(() => …)`). An alias (`const Icon = open ? Up : Down`) renders an imported component.
  const functionLike = (node) =>
    node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isClassExpression(node));
  const definesComponent = (node) =>
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    (ts.isVariableDeclaration(node) &&
      (functionLike(node.initializer) ||
        (node.initializer && ts.isCallExpression(node.initializer) && node.initializer.arguments.some(functionLike))));
  const declared = new Set();
  const collect = (node) => {
    if (
      definesComponent(node) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      /^[A-Z]/.test(node.name.text) &&
      node.name.text !== exportedName
    )
      declared.add(node.name.text);
    ts.forEachChild(node, collect);
  };
  collect(source);
  const tags = (node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName))
      if (declared.has(node.tagName.text))
        found.push({ line: line(node), what: `<${node.tagName.text}>, a component declared in this file` });
    ts.forEachChild(node, tags);
  };
  tags(source);
  return found;
}

/**
 * The uses of a component folder that leave it without its boundaries. A folder is one component,
 * and its `Suspense` and error boundary are composed around its element where the plugin sees the
 * element written: a default import, used as a JSX tag, in a render, placeholder or error file.
 * Anything else is named, each as `{ line, what }`:
 * - in one of those files, an import of a folder that is not its default alone, and the folder's
 *   name used as a value (held in a variable, passed as a prop, given to `createElement`);
 * - in any other file of a component folder (`props.ts`, `state.ts`, `handlers.ts`…), an import of
 *   a folder at all: what it would build there, no render composes.
 * A type-only import says nothing at runtime, and a skin imports a folder for its selector.
 */
function unboundFolders(root, file, rendering) {
  const ts = typescriptFor(root);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const found = [];
  const names = new Set();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    const from = statement.moduleSpecifier.text;
    const resolved = from.startsWith('@/')
      ? path.join(root, from.slice(2))
      : from.startsWith('.')
        ? path.resolve(path.dirname(file), from)
        : null;
    if (!resolved || !isComponentFolder(root, resolved)) continue;
    if (!rendering) {
      found.push({
        line: line(statement),
        what: `imports the component ${from}: a component is written in a render, placeholder or error file, as a JSX tag, where its boundaries are composed around it`,
      });
      continue;
    }
    if (clause.namedBindings)
      found.push({
        line: line(statement),
        what: `imports the component ${from} by another name than its default: write \`import Name from '${from}'\`, the import whose elements get the folder's boundaries`,
      });
    if (clause.name) names.add(clause.name.text);
  }
  if (!names.size) return found;
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node) && names.has(node.text)) {
      const parent = node.parent;
      const isTag =
        (ts.isJsxOpeningElement(parent) || ts.isJsxSelfClosingElement(parent) || ts.isJsxClosingElement(parent)) &&
        parent.tagName === node;
      // A name that is not a reference: a member (`all.Row`), a key (`{ Row: 1 }`), an attribute.
      const isName =
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        ts.isJsxAttribute(parent);
      if (!isTag && !isName)
        found.push({
          line: line(node),
          what: `uses the component ${node.text} as a value: write it as a JSX tag, \`<${node.text} … />\`, so its placeholder and error file are composed around it`,
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Inline event handlers in a render: every event a render wires is a handler of its folder's handlers.ts. */
function inlineHandlers(root, file) {
  const ts = typescriptFor(root);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const visit = (node) => {
    if (
      ts.isJsxAttribute(node) &&
      /^on[A-Z]/.test(node.name.text) &&
      node.initializer &&
      ts.isJsxExpression(node.initializer)
    ) {
      let expression = node.initializer.expression;
      while (
        expression &&
        (ts.isParenthesizedExpression(expression) ||
          ts.isAsExpression(expression) ||
          ts.isSatisfiesExpression(expression))
      )
        expression = expression.expression;
      if (expression && (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)))
        found.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Named handler exports should say what happens, not which event calls them. */
function eventNamedHandlers(root, file) {
  const ts = typescriptFor(root);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found = [];
  const check = (name, node) => {
    if (/^(?:on|handle)[A-Z]/.test(name))
      found.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, name });
  };
  for (const statement of source.statements) {
    const exported =
      ts.canHaveModifiers(statement) &&
      (ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (exported && ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) check(declaration.name.text, declaration.name);
    } else if (exported && ts.isFunctionDeclaration(statement) && statement.name)
      check(statement.name.text, statement.name);
    else if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    )
      for (const element of statement.exportClause.elements)
        if (!element.isTypeOnly) check(element.name.text, element.name);
  }
  return found;
}

/**
 * Handler exports whose dependencies cannot be read from their source, so the handler depends on
 * everything it is given and is a new function at every render: one whose parameter is not
 * destructured or has a rest element, and one that is not a function written in the file.
 */
function unreadableHandlers(root, file) {
  const ts = typescriptFor(root);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found = [];
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const unwrap = (node) => {
    while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)))
      node = node.expression;
    return node;
  };
  const check = (name, fn, node) => {
    if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) || ts.isFunctionDeclaration(fn)))
      return void found.push({ line: line(node), name, why: 'is not a function written in this file' });
    const parameter = fn.parameters[0];
    if (!parameter) return;
    if (!ts.isObjectBindingPattern(parameter.name))
      found.push({ line: line(node), name, why: 'takes a parameter that is not destructured' });
    else if (parameter.name.elements.some((element) => element.dotDotDotToken))
      found.push({ line: line(node), name, why: 'takes the rest of what it is given (`...`)' });
  };
  const declared = new Map();
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) declared.set(declaration.name.text, unwrap(declaration.initializer));
    if (ts.isFunctionDeclaration(statement) && statement.name) declared.set(statement.name.text, statement);
  }
  for (const statement of source.statements) {
    const exported =
      ts.canHaveModifiers(statement) &&
      (ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (exported && ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name))
          check(declaration.name.text, declared.get(declaration.name.text), declaration.name);
    } else if (exported && ts.isFunctionDeclaration(statement) && statement.name)
      check(statement.name.text, statement, statement.name);
    else if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    )
      for (const element of statement.exportClause.elements)
        if (!element.isTypeOnly && element.name.text !== 'default')
          check(
            element.name.text,
            statement.moduleSpecifier ? undefined : declared.get((element.propertyName ?? element.name).text),
            element.name,
          );
  }
  return found;
}

/**
 * What the framework may give a component beyond its props and its own layers. Each is read by
 * the component only when one of its files asks for it (`readsOf`), so a change of locale, of
 * user, of what the person may do or of a flag renders again the components that read it, and
 * no other.
 */
const SOURCES = ['intl', 'locale', 'i18n', 'user', 'acl', 'flags', 'route', 'keyboard'];

/**
 * The top-level names the first parameter of each function the framework calls in a component's
 * files destructures: `({ async, intl }) => …` reads `async` and `intl`. The framework calls the
 * default export of each file, and the named exports of `async.ts` (operations) and `state.ts`
 * (checks and changes); a helper a file exports for itself or its tests (`sorting(id)` in a
 * props.ts) is not called with what the framework gives, so it reads nothing. A parameter that is not
 * destructured (`(props) => …`) may read anything, so it reads every source. The render is left
 * out when a props.ts shapes what it gets, since it then sees props.ts's output, not the sources.
 * Returns the sources each file reads and all of them, each in SOURCES order, and every name
 * each file destructures (`*` for a parameter that is not destructured):
 * `{ all: ['intl'], byLayer: { props: ['intl'], async: [] }, names: { props: ['intl', 'async'] } }`.
 */
function readsOf(root, dir) {
  const ts = typescriptFor(root);
  const all = new Set();
  const byLayer = {};
  const names = {};
  let read;
  let named;
  const shaped = Boolean(findLayer(dir, 'props'));
  const files = ['props', 'async', 'state', 'acl', 'handlers', 'shortcuts', ...(shaped ? [] : ['render'])];
  const exported = (node) =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  const isFunction = (node) =>
    node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node));
  const isDefault = (node) =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
  const collect = (fn) => {
    const parameter = fn.parameters[0];
    if (!parameter) return;
    if (ts.isObjectBindingPattern(parameter.name)) {
      for (const element of parameter.name.elements) {
        const name = element.propertyName ?? element.name;
        if (element.dotDotDotToken) {
          SOURCES.forEach((source) => read.add(source));
          named.add('*');
        } else if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
          read.add(name.text);
          named.add(name.text);
        }
      }
    } else {
      SOURCES.forEach((source) => read.add(source));
      named.add('*');
    }
  };
  for (const layer of files) {
    const file = findLayer(dir, layer);
    if (!file) continue;
    read = new Set();
    named = new Set();
    const callsNamed = layer === 'async' || layer === 'state' || layer === 'handlers';
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      JSX_FILE.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    for (const statement of source.statements) {
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        let expression = statement.expression;
        while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
        if (isFunction(expression)) {
          // A chart's declaration, apart: what it reads may change the chart's shape.
          if (layer === 'state') {
            const before = new Set(named);
            named = new Set();
            collect(expression);
            names.chart = [...named].sort();
            named = new Set([...before, ...named]);
          } else collect(expression);
        }
      } else if (ts.isFunctionDeclaration(statement) && exported(statement) && (callsNamed || isDefault(statement)))
        collect(statement);
      else if (callsNamed && ts.isVariableStatement(statement) && exported(statement)) {
        for (const declaration of statement.declarationList.declarations)
          if (isFunction(declaration.initializer)) collect(declaration.initializer);
      }
    }
    byLayer[layer] = SOURCES.filter((source) => read.has(source));
    names[layer] = [...named].sort();
    for (const source of read) all.add(source);
  }
  return { all: SOURCES.filter((source) => all.has(source)), byLayer, names };
}

/** Owned operation names and the fixed status fields their observing layers read. */
function operationsOf(root, dir) {
  const ts = typescriptFor(root);
  const fields = ['pending', 'error', 'data', 'actor'];

  const unwrap = (node) => {
    while (
      node &&
      (ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isTypeAssertionExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isNonNullExpression(node))
    )
      node = node.expression;

    return node;
  };

  const exported = (node, kind) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);

  const exportsOf = (layer) => {
    const file = findLayer(dir, layer);
    const found = new Map();

    if (!file) return found;

    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      JSX_FILE.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const declared = new Map();

    const declarations = (statement) =>
      ts.isVariableStatement(statement)
        ? statement.declarationList.declarations
        : ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)
          ? [statement]
          : [];

    for (const statement of source.statements)
      for (const declaration of declarations(statement))
        if (declaration.name && ts.isIdentifier(declaration.name))
          declared.set(declaration.name.text, unwrap(declaration.initializer ?? declaration));

    const resolve = (node) => {
      node = unwrap(node);

      return node && ts.isIdentifier(node) ? declared.get(node.text) : node;
    };

    for (const statement of source.statements) {
      if (ts.isExportAssignment(statement) && !statement.isExportEquals)
        found.set('default', resolve(statement.expression));
      else if (exported(statement, ts.SyntaxKind.ExportKeyword)) {
        for (const declaration of declarations(statement)) {
          const name = exported(statement, ts.SyntaxKind.DefaultKeyword) ? 'default' : declaration.name?.text;

          if (name) found.set(name, resolve(declaration.initializer ?? declaration));
        }
      } else if (
        ts.isExportDeclaration(statement) &&
        !statement.isTypeOnly &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause)
      )
        for (const element of statement.exportClause.elements)
          if (!element.isTypeOnly)
            found.set(
              element.name.text,
              statement.moduleSpecifier ? undefined : declared.get((element.propertyName ?? element.name).text),
            );
    }

    return found;
  };

  const names = [...exportsOf('async').keys()].filter((name) => name !== 'default').sort();
  const status = new Map(names.map((name) => [name, new Set()]));

  const add = (operation, field) => {
    // A source prop is not an owned operation; its binding is a separate contract.
    for (const name of operation === undefined ? names : [operation]) {
      const read = status.get(name);

      if (read) for (const each of fields.includes(field) ? [field] : fields) read.add(each);
    }
  };

  const keyOf = (node) => (ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined);

  const collect = (fn) => {
    if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) || ts.isFunctionDeclaration(fn))) return add();
    const parameter = fn.parameters[0];

    if (!parameter) return;

    if (!ts.isObjectBindingPattern(parameter.name)) return add();
    const bound = new Map();

    const bindStatus = (pattern, operation) => {
      if (ts.isIdentifier(pattern)) bound.set(pattern.text, operation);
      else if (ts.isObjectBindingPattern(pattern)) {
        for (const element of pattern.elements) {
          const key = keyOf(element.propertyName ?? element.name);

          if (element.dotDotDotToken || key === undefined) add(operation);
          else if (operation === undefined) bindStatus(element.name, key);
          else add(operation, key);
        }
      } else add(operation);
    };

    for (const element of parameter.name.elements) {
      const key = keyOf(element.propertyName ?? element.name);

      if (element.dotDotDotToken || key === undefined) add();
      else if (key === 'status') bindStatus(element.name);
    }

    const visit = (node) => {
      if (ts.isTypeNode(node)) return;

      if (ts.isIdentifier(node) && bound.has(node.text)) {
        const parent = node.parent;

        const isName =
          (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
          (ts.isBindingElement(parent) && parent.propertyName === node) ||
          (ts.isPropertyAssignment(parent) && parent.name === node) ||
          ts.isJsxAttribute(parent);

        if (!isName) {
          let value = node;

          const member = () => {
            while (value.parent && unwrap(value.parent) === value) value = value.parent;

            if (ts.isPropertyAccessExpression(value.parent) && value.parent.expression === value) {
              value = value.parent;

              return value.name.text;
            }

            return undefined;
          };

          const operation = bound.get(node.text) ?? member();
          add(operation, operation === undefined ? undefined : member());
        }
      }

      ts.forEachChild(node, visit);
    };
    // A shadowed name may widen the read, never hide an outer reference.

    if (fn.body) visit(fn.body);

    const defaults = (node) => {
      if ((ts.isBindingElement(node) || ts.isParameter(node)) && node.initializer) visit(node.initializer);
      ts.forEachChild(node, defaults);
    };

    for (const each of fn.parameters) defaults(each);
  };

  for (const layer of ['props', 'handlers', 'shortcuts', 'acl', ...(findLayer(dir, 'props') ? [] : ['render'])])
    for (const [name, fn] of exportsOf(layer)) if (layer === 'handlers' || name === 'default') collect(fn);

  return {
    names,
    status: Object.fromEntries(names.map((name) => [name, fields.filter((field) => status.get(name).has(field))])),
  };
}

/**
 * The messages of a component's `i18n.ts`, read without running it: its default export must be
 * an object literal whose leaves are strings (ICU messages) or functions, nested in objects as
 * deep as the author likes. Returns `{ leaves, issues }`: each leaf's path (`empty/actions/clear`)
 * with its text, or `null` for a function, and what is wrong, by line.
 */
function messagesOf(root, file) {
  const ts = typescriptFor(root);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const leaves = new Map();
  const issues = [];
  const unwrap = (node) => {
    while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)))
      node = node.expression;
    return node;
  };
  const walk = (object, at) => {
    for (const property of object.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      ) {
        issues.push({
          line: line(property),
          message: 'a message is written as `name: value`, so its path can be read without running the file',
        });
        continue;
      }
      const path = [...at, property.name.text];
      const value = unwrap(property.initializer);
      if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
        leaves.set(path.join('/'), value.text);
      else if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) leaves.set(path.join('/'), null);
      else if (ts.isObjectLiteralExpression(value)) walk(value, path);
      else
        issues.push({
          line: line(property),
          message: `\`${path.join('.')}\` is neither a string, a function nor an object of them`,
        });
    }
  };
  const exported = source.statements.find((statement) => ts.isExportAssignment(statement) && !statement.isExportEquals);
  const object = exported && unwrap(exported.expression);
  if (!object || !ts.isObjectLiteralExpression(object))
    issues.push({ line: exported ? line(exported) : 1, message: 'default-exports no object literal of messages' });
  else walk(object, []);
  return { issues, leaves };
}

/** A message's ICU arguments and tags, as sorted names; `null` with the reason when it does not parse. */
function icuNames(message) {
  // An ES module, which Node loads with `require` from 20.19 on. Required from this file's own
  // path: Vite bundles its config, this file with it, and a bare `require` there resolves wrongly.
  const { parse } = createRequire(__filename)('@formatjs/icu-messageformat-parser');
  const names = new Set();
  const visit = (elements) => {
    for (const element of elements) {
      if (element.type === 0 || element.type === 7) continue;
      names.add(element.type === 8 ? `<${element.value}>` : `{${element.value}}`);
      if (element.options) for (const option of Object.values(element.options)) visit(option.value);
      if (element.children) visit(element.children);
    }
  };
  try {
    visit(parse(message));
    return { names: [...names].sort() };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * The translation files of a component folder: `i18n/<locale>.json`, each a flat object whose
 * keys are the folder's path and the message's path (`components/catalogue/empty/title`).
 */
function listTranslations(dir) {
  const folder = path.join(dir, 'i18n');
  if (!isDirectory(folder)) return [];
  return readdirSync(folder)
    .sort()
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => ({ file: path.join(folder, entry), locale: entry.slice(0, -'.json'.length) }));
}

/**
 * What is wrong with a component's messages and their translations: `i18n.ts` that cannot be read
 * as data, and translation files that miss a message, name one `i18n.ts` lacks, or change its
 * ICU arguments or tags. Each as `{ file, message }`.
 */
function i18nProblems(root, dir) {
  const file = findLayer(dir, 'i18n');
  if (!file)
    return listTranslations(dir).length
      ? [
          {
            file: posix(path.relative(root, path.join(dir, 'i18n'))),
            message: 'holds translations, but the folder has no i18n.ts',
          },
        ]
      : [];
  const found = [];
  const relative = (target) => posix(path.relative(root, target));
  const { issues, leaves } = messagesOf(root, file);
  for (const issue of issues) found.push({ file: `${relative(file)}:${issue.line}`, message: issue.message });
  const base = componentPath(root, dir);
  for (const [key, text] of leaves) {
    if (text === null) continue;
    const icu = icuNames(text);
    if (icu.error) found.push({ file: relative(file), message: `\`${key}\` is not an ICU message: ${icu.error}` });
  }
  for (const { file: translations, locale } of listTranslations(dir)) {
    let entries;
    try {
      entries = JSON.parse(readFileSync(translations, 'utf8'));
    } catch (error) {
      found.push({ file: relative(translations), message: `is not JSON: ${error.message}` });
      continue;
    }
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      found.push({ file: relative(translations), message: 'is not an object of messages' });
      continue;
    }
    for (const [key, value] of Object.entries(entries)) {
      const own = key.startsWith(`${base}/`) ? key.slice(base.length + 1) : null;
      if (own === null)
        found.push({
          file: relative(translations),
          message: `"${key}" is not a message of ${base}: its keys start with "${base}/"`,
        });
      else if (!leaves.has(own))
        found.push({ file: relative(translations), message: `"${key}" names a message i18n.ts does not have` });
      else if (leaves.get(own) === null)
        found.push({
          file: relative(translations),
          message: `"${key}" translates a function, which is not translated`,
        });
      else if (typeof value !== 'string')
        found.push({ file: relative(translations), message: `"${key}" is not a string` });
      else {
        const source = icuNames(leaves.get(own));
        const translated = icuNames(value);
        if (translated.error)
          found.push({ file: relative(translations), message: `"${key}" is not an ICU message: ${translated.error}` });
        else if (!source.error) {
          const lost = source.names.filter((name) => !translated.names.includes(name));
          const added = translated.names.filter((name) => !source.names.includes(name));
          if (lost.length) found.push({ file: relative(translations), message: `"${key}" loses ${lost.join(', ')}` });
          if (added.length)
            found.push({
              file: relative(translations),
              message: `"${key}" adds ${added.join(', ')}, which i18n.ts does not pass`,
            });
        }
      }
    }
    for (const [key, text] of leaves) {
      if (text !== null && !Object.hasOwn(entries, `${base}/${key}`))
        found.push({ file: relative(translations), message: `misses "${base}/${key}" (${locale})` });
    }
  }
  return found;
}

/**
 * The convention mistakes that would otherwise fail silently or far from their cause:
 * each names the file and the rule. The Vite plugin shows them as warnings; `npm run typecheck`
 * (typescript/check.cjs) fails on them, since agents run the type check.
 */
function problems(root) {
  const found = [];
  const relative = (file) => posix(path.relative(root, file));
  const visit = (dir, check) => {
    if (!isDirectory(dir)) return;
    for (const entry of readdirSync(dir).sort()) {
      const child = path.join(dir, entry);
      if (isDirectory(child) && !entry.startsWith('.')) {
        check(child);
        visit(child, check);
      }
    }
  };

  visit(path.join(root, 'components'), (dir) => {
    if (path.basename(dir) === 'style' || dir.includes(`${path.sep}style${path.sep}`)) return;
    const entries = readdirSync(dir).filter(isCode);
    for (const entry of entries) {
      const base = stripExtension(entry);
      const layer = LAYER_NAMES.find((name) => name === base.toLowerCase());
      if (layer && base !== layer)
        found.push({
          file: relative(path.join(dir, entry)),
          message: `rename to ${layer}${entry.slice(base.length)}: layer files are lower case`,
        });
    }
    const render = findLayer(dir, 'render');
    const index = findLayer(dir, 'index');
    if (render && index)
      found.push({
        file: relative(dir),
        message: 'has both render and index: a folder with an index is left alone, so its render is not used',
      });
    const layers = LAYER_NAMES.filter((name) => name !== 'render' && findLayer(dir, name));
    if (!render && !index && layers.length)
      found.push({
        file: relative(dir),
        message: `has ${layers.map((name) => `${name}.*`).join(', ')} but no render.tsx, so it is not a component`,
      });
    const handlers = findLayer(dir, 'handlers');
    if (handlers)
      for (const { line, name } of eventNamedHandlers(root, handlers))
        found.push({
          file: `${relative(handlers)}:${line}`,
          message: `handler ${name} names an event: name it for what it does`,
        });
    if (handlers)
      for (const { line, name, why } of unreadableHandlers(root, handlers))
        found.push({
          file: `${relative(handlers)}:${line}`,
          message: `handler ${name} ${why}, so what it reads cannot be told and it is a new function at every render: write it as \`({ state }) => (event) => …\`, destructuring what it uses`,
        });
    if (isComponentFolder(root, dir)) found.push(...i18nProblems(root, dir));
  });

  visit(path.join(root, 'services'), (dir) => {
    const meta = findLayer(dir, 'meta');
    if (meta && !findLayer(dir, 'index'))
      found.push({ file: relative(meta), message: 'describes no service: there is no index beside it' });
  });

  const clients = path.join(root, 'clients');
  if (isDirectory(clients)) {
    for (const entry of readdirSync(clients).sort()) {
      const dir = path.join(clients, entry);
      if (isDirectory(dir) && !findLayer(dir, 'index'))
        found.push({ file: relative(dir), message: 'is not a client: it has no index' });
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
            const child = path.join(dir, entry);
            return isDirectory(child) ? files(child) : isCode(entry) ? [child] : [];
          });
  // A folder's element gets the folder's boundaries only where the plugin sees it written.
  for (const file of files(path.join(root, 'components'))) {
    const inStyle = relative(file).split('/').includes('style');
    if (inStyle || /\.(test|spec|stories)\.[jt]sx?$/.test(file) || !isComponentFolder(root, path.dirname(file)))
      continue;
    const rendering = JSX_FILE.test(file) && RENDERING_LAYERS.includes(stripExtension(path.basename(file)));
    for (const { line, what } of unboundFolders(root, file, rendering))
      found.push({ file: `${relative(file)}:${line}`, message: what });
  }
  for (const file of ['components', 'services', 'clients'].flatMap((layer) => files(path.join(root, layer)))) {
    if (!JSX_FILE.test(file)) continue;
    const rendering = RENDERING_LAYERS.includes(stripExtension(path.basename(file)));
    if (!rendering || !isComponentFolder(root, path.dirname(file))) {
      found.push({
        file: relative(file),
        message:
          "holds JSX outside a component folder's render, placeholder or error, where handlers are not tracked: give each component in it a folder of its own, with a render.tsx",
      });
      continue;
    }
    for (const { line, what } of secondComponents(root, file))
      found.push({
        file: `${relative(file)}:${line}`,
        message: `holds a second component, ${what}: one component per file, so give it a folder of its own, with a render.tsx`,
      });
    if (stripExtension(path.basename(file)) === 'render')
      for (const line of inlineHandlers(root, file))
        found.push({
          file: `${relative(file)}:${line}`,
          message: 'has an inline on… function: put the handler in handlers.ts',
        });
  }
  return found;
}

module.exports = {
  camelCase,
  clientName,
  CODE,
  componentPath,
  declaredProps,
  escapeIdentifier,
  findLayer,
  i18nProblems,
  isCode,
  isComponentFolder,
  isDirectory,
  listClients,
  listComponentFolders,
  listServices,
  listSkins,
  listTranslations,
  messagesOf,
  operationsOf,
  posix,
  problems,
  readsOf,
  selector,
  SOURCES,
  stripExtension,
};
