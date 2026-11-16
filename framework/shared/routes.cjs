// The routes realm is read without running application code, in the editor and in the build.
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const typescriptPath = require.resolve('typescript');
const ts = require(typescriptPath);

const folders = require('./folders.cjs');

function source(file) {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}
function literal(node, file) {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))
    return literal(node.expression, file);
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node))
    return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((value) => literal(value, file));
  if (ts.isObjectLiteralExpression(node))
    return Object.fromEntries(
      node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name))
          throw new Error(`${file}: route metadata needs literal properties`);
        return [property.name.text, literal(property.initializer, file)];
      }),
    );
  throw new Error(`${file}: route metadata must be a literal object, so its contract can be generated`);
}
function metadata(dir) {
  const file = folders.findLayer(dir, 'meta');
  if (!file) return {};
  const exported = source(file).statements.find(ts.isExportAssignment);
  if (!exported) throw new Error(`${file}: route metadata needs a default export`);
  return literal(exported.expression, file);
}
function fields(values = {}, file, parameters = false) {
  for (const [key, field] of Object.entries(values)) {
    if (
      !/^[A-Za-z_]\w*$/.test(key) ||
      ['__proto__', 'constructor', 'params', 'path', 'pattern', 'prototype', 'v'].includes(key)
    )
      throw new Error(`${file}: reserved field ${key}`);
    if (!['boolean', 'integer', 'number', 'string'].includes(field.type))
      throw new Error(`${file}: unknown type for ${key}`);
    if (parameters && !['integer', 'number', 'string'].includes(field.type))
      throw new Error(`${file}: a path parameter must be a string or number`);
    if (!parameters && field.default === undefined) throw new Error(`${file}: query field ${key} needs a default`);
    if (field.default !== undefined && typeof field.default !== (field.type === 'integer' ? 'number' : field.type))
      throw new Error(`${file}: wrong default for ${key}`);
    if (
      field.enum &&
      (!Array.isArray(field.enum) ||
        field.enum.some((value) => typeof value !== 'string') ||
        (field.default !== undefined && !field.enum.includes(field.default)))
    )
      throw new Error(`${file}: invalid enum for ${key}`);
    if (field.pattern) new RegExp(field.pattern);
  }
  return values;
}
function routedStates(file) {
  const found = [];
  const visit = (node, at) => {
    if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.initializer)) {
      const meta = node.initializer.properties.find(
        (property) => ts.isPropertyAssignment(property) && property.name.getText() === 'meta',
      );
      if (meta) {
        const route = literal(meta.initializer, file).route;
        if (route !== undefined) found.push({ route, state: [...at, node.name.text].join('.') });
      }
      const nested = node.initializer.properties.find(
        (property) => ts.isPropertyAssignment(property) && property.name.getText() === 'states',
      );
      if (nested) ts.forEachChild(nested.initializer, (child) => visit(child, [...at, node.name.text]));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, at));
  };
  const exported = source(file).statements.find(ts.isExportAssignment);
  if (exported) visit(exported.expression, []);
  return found;
}

function scanRoutes(root) {
  const components = folders.listComponentFolders(root);
  const owners = components.filter(
    (dir) =>
      folders.isDirectory(path.join(dir, 'routes')) && !folders.posix(path.relative(root, dir)).includes('/routes/'),
  );
  const routes = [];
  let global = {};
  let home;
  const seen = new Set();
  const add = (dir, owner, pattern, params, query, chart) => {
    if (!/^\/(?:[A-Za-z0-9_-]+|:[A-Za-z_]\w*)(?:\/(?:[A-Za-z0-9_-]+|:[A-Za-z_]\w*))*$/.test(pattern))
      throw new Error(`${dir}: unsupported route path ${pattern}; use static segments and named parameters`);
    const signature = pattern.replace(/:[A-Za-z_]\w*/g, ':');
    if (seen.has(signature)) throw new Error(`${dir}: ambiguous route ${pattern}`);
    seen.add(signature);
    const keys = [...pattern.matchAll(/:([A-Za-z_]\w*)/g)].map((match) => match[1]);
    if (new Set(keys).size !== keys.length || Object.keys(params).some((key) => !keys.includes(key)))
      throw new Error(`${dir}: parameters must name distinct segments of ${pattern}`);
    const entry = {
      chart,
      folder: folders.posix(path.relative(root, dir)),
      keys,
      owner: folders.posix(path.relative(root, owner)),
      params,
      path: pattern,
      query,
    };
    routes.push(entry);
    return entry;
  };
  const children = (owner, base, inheritedParams, inheritedQuery) => {
    const dir = path.join(owner, 'routes');
    if (!folders.isDirectory(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const child = path.join(dir, name);
      if (!folders.isDirectory(child) || name.startsWith('.')) continue;
      if (!folders.isComponentFolder(root, child)) throw new Error(`${child}: each child of routes/ needs render.tsx`);
      const meta = metadata(child);
      const pattern = `${base}/${meta.path ?? name}`;
      const params = { ...inheritedParams, ...fields(meta.params, child, true) };
      const query = { ...inheritedQuery, ...fields(meta.query, child) };
      add(child, owner, pattern, params, query);
      children(child, pattern, params, query);
      if (meta.chart || folders.findLayer(child, 'state')) {
        const chartDir = meta.chart ? path.resolve(root, meta.chart) : child;
        if (!chartDir.startsWith(root + path.sep))
          throw new Error(`${child}: the chart must be inside the source root`);
        const file = folders.findLayer(chartDir, 'state');
        if (!file) throw new Error(`${child}: no state.ts in ${meta.chart}`);
        for (const { route, state } of routedStates(file)) {
          if (typeof route !== 'string' || !route) throw new Error(`${file}: meta.route must name a child path`);
          add(path.join(child, `#${state}`), child, `${pattern}/${route}`, params, query, {
            component: folders.componentPath(root, chartDir),
            state,
          });
        }
      }
    }
  };
  for (const owner of owners) {
    const meta = metadata(path.join(owner, 'routes'));
    global = { ...global, ...fields(meta.query, owner) };
    home ??= meta.home;
    children(owner, '', {}, {});
  }
  // A literal segment wins over a parameter at the same depth; deeper routes win over their parents.
  routes.sort((a, b) => {
    const left = a.path.split('/');
    const right = b.path.split('/');
    for (let index = 1; index < Math.min(left.length, right.length); index++) {
      const difference = Number(left[index].startsWith(':')) - Number(right[index].startsWith(':'));
      if (difference) return difference;
    }
    return right.length - left.length || a.path.localeCompare(b.path);
  });
  if (routes.length && !routes.some((route) => route.path === home && !route.keys.length))
    throw new Error('routes/meta.ts must name a static home route');
  return { global, home, routes };
}

const fieldType = (field) =>
  field.enum
    ? field.enum.map((value) => JSON.stringify(value)).join(' | ')
    : field.type === 'integer'
      ? 'number'
      : field.type;
const shape = (fields) =>
  `{ ${Object.entries(fields)
    .map(([key, field]) => `${JSON.stringify(key)}: ${fieldType(field)}`)
    .join('; ')} }`;
function routeTypes(scan) {
  const all = Object.assign({}, scan.global, ...scan.routes.map((route) => route.query));
  const params = Object.assign(
    {},
    ...scan.routes.map((route) =>
      Object.fromEntries(route.keys.map((key) => [key, route.params[key] ?? { type: 'string' }])),
    ),
  );
  return [
    '// Generated by framework/plugin. Do not edit.',
    "import type { TypedNavigation, ParametersOf, Route } from 'framework';",
    'export interface RoutePatterns {',
    ...scan.routes.map(
      (route) =>
        `  ${JSON.stringify(route.path)}: { params: ${shape(route.params)}; query: ${shape({ ...scan.global, ...route.query })} };`,
    ),
    '}',
    'export type RoutePattern = keyof RoutePatterns;',
    "export type RouteParameters<Path extends RoutePattern> = ParametersOf<Path, RoutePatterns[Path]['params']>;",
    "export type RouteQuery<Path extends RoutePattern> = RoutePatterns[Path]['query'];",
    '/** The route under one pattern: the parameters that pattern names, and no other. */',
    'export type RouteAt<Path extends RoutePattern> = Route & {',
    '  params: RouteParameters<Path> & { [Key in Exclude<keyof Route["params"], keyof RouteParameters<Path>>]?: undefined };',
    '  pattern: Path;',
    '};',
    'type RoutesByPattern = { [Path in RoutePattern]: RouteAt<Path> };',
    `export type GlobalQuery = ${shape(scan.global)};`,
    `export type Query = ${shape(all)};`,
    'declare module "framework" {',
    '  interface Navigation extends TypedNavigation<RoutePatterns, GlobalQuery> {}',
    `  interface Route extends Query { params: { ${Object.entries(params)
      .map(([key, field]) => `${JSON.stringify(key)}?: ${fieldType(field)}`)
      .join('; ')} }; path: string; pattern: RoutePattern }`,
    '  interface Routed extends RoutesByPattern {}',
    '}',
    '',
  ].join('\n');
}

module.exports = { metadata, routedStates, routeTypes, scanRoutes };
