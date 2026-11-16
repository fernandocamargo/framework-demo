// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// @ts-expect-error The plugin is plain JavaScript, with no declarations.
import framework, { resolveOptions, writeTypes } from '../../plugin/index.mjs';
// @ts-expect-error The generator is plain JavaScript, with no declarations.
import { addressModule, routesModule, routeTypes, scanRoutes, staticPages } from '../../plugin/routes.mjs';
import { type AddressCodec, createCodec } from '../address';

type Scan = {
  global: object;
  home: string;
  routes: {
    chart?: { state: string };
    folder: string;
    keys: string[];
    owner: string;
    params: object;
    path: string;
    query: object;
  }[];
};
let root: string;
const write = (relative: string, text: string) => {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const route = (relative: string, meta?: string) => {
  write(`${relative}/render.tsx`, 'export default ({ routes }) => routes;');
  if (meta) write(`${relative}/meta.ts`, `export default ${meta};`);
};
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'framework-routes-'));
  route('components/app');
  write(
    'components/app/routes/meta.ts',
    "export default { home: '/products', query: { signin: { type: 'boolean', default: false } } };",
  );
  route('components/app/routes/products', "{ query: { page: { type: 'integer', default: 1, min: 1 } } }");
  route('components/app/routes/products/routes/:id', "{ params: { id: { type: 'integer', min: 1 } } }");
  route('components/app/routes/products/routes/:id/routes/editor', "{ path: 'edit' }");
  route('components/app/routes/products/routes/new');
});
afterEach(() => {
  rmSync(root, { force: true, recursive: true });
  vi.unstubAllGlobals();
});

test('direct children are components, paths concatenate, and each realm keeps its own metadata', () => {
  write('services/products/index.ts', 'export const get = () => () => 4;');
  write('services/products/meta.ts', 'export default () => ({ get: { reads: true } });');
  // SAFETY: The generator reads the literal fixture above.
  const scan = scanRoutes(root) as Scan;
  expect(scan.routes.find(({ path }) => path === '/products/:id/edit')).toMatchObject({
    folder: 'components/app/routes/products/routes/:id/routes/editor',
    keys: ['id'],
    owner: 'components/app/routes/products/routes/:id',
    params: { id: { min: 1, type: 'integer' } },
    query: { page: { default: 1, min: 1, type: 'integer' } },
  });
  expect(scan.routes.map(({ path }) => path)).toContain('/products/new');
  expect(scan.routes).toHaveLength(4);
});

test('an index child has an explicit marker and no path segment', () => {
  route('components/app/routes/products/routes/overview', '{ index: true }');
  // SAFETY: The generator reads the literal fixture above.
  const scan = scanRoutes(root) as Scan;
  // SAFETY: The generator reads the literal fixture above.
  const generated = routesModule(scan, root, 'components/app/routes/products') as { element: string };
  expect(generated.element).toContain('index: true');
  expect(scan.routes.find((route) => route.folder.endsWith('/overview'))?.path).toBe('/products');
});

test('the generated codec validates params and honors the base', () => {
  const code = addressModule(scanRoutes(root), '"framework"', '/framework-demo/') as string;
  const codec = new Function(
    'createCodec',
    code
      .replace(/^import .*\n/gm, '')
      .replace(/^export \{.*\n/gm, '')
      .replace('export const codec', 'const codec')
      .replace('export default codec;', 'return codec;'),
  )(createCodec) as AddressCodec;
  expect(codec.format('/products/:id/edit', { id: 4 }, { page: 2 })).toMatch(
    /^\/framework-demo\/products\/4\/edit\?query=/,
  );
  // What the router matched, as text, becomes the route's typed parameters; one its meta refuses goes home.
  expect(codec.at('/products/:id/edit', { id: '4' }, '', '').params).toEqual({ id: 4 });
  expect(codec.at('/products/:id/edit', { id: 'four' }, '', '').pattern).toBe('/products');
  expect(codec.at(undefined, {}, '', '').pattern).toBe('/products');
  expect(() => codec.pathOf('/products/:id/edit', {})).toThrow('Invalid parameter id');
  expect(() => codec.pathOf('/products/:id', { extra: 2, id: 4 })).toThrow('Extra parameter');
});

test('a folder generates only its direct routes, and descendants own their own Routes', () => {
  const scan = scanRoutes(root);
  // SAFETY: The generator reads the literal fixture above.
  const parent = routesModule(scan, root, 'components/app') as { element: string; imports: string[] };
  expect(parent.imports).toHaveLength(1);
  expect(parent.element).toContain('path: "products/*"');
  expect(parent.element).not.toContain(':id');
  // SAFETY: The generator reads the literal fixture above.
  const products = routesModule(scan, root, 'components/app/routes/products') as { element: string; imports: string[] };
  expect(products.element).toContain('path: ":id/*"');
  expect(products.element).toContain('path: "new"');
  expect(products.element).not.toContain('path: "edit"');
});

test("the folder's routes prop is React Router's Routes element, and its declarations include every pattern", () => {
  const options = resolveOptions({ cwd: root, root: '.', runtime: 'runtime.ts' });
  writeTypes(options);
  const code = framework(options).load('\0framework-component:' + path.join(root, 'components/app')) as string;
  expect(code).toContain("import { Route, Routes } from 'react-router';");
  expect(code).toContain('routes: createElement(Routes, null,');
  expect(code).not.toMatch(/Outlet|lazy:|loader:/);
  const types = readFileSync(path.join(root, '.framework-types/routes.d.ts'), 'utf8');
  expect(types).toBe(routeTypes(scanRoutes(root)));
  expect(types).toContain(
    '"/products/:id/edit": { params: { "id": number }; query: { "signin": boolean; "page": number } }',
  );
});

test('generated route children preload with the folders imported by the render', () => {
  const plugin = framework({ cwd: root, root: '.', runtime: 'runtime.ts' });
  // SAFETY: The plugin returns source text for this fixture's view module.
  const code = plugin.load('\0framework-view:' + path.join(root, 'components/app/routes/products')) as string;
  expect(code).toContain('framework-component:' + path.join(root, 'components/app/routes/products/routes/:id'));
  expect(code).toContain('framework-component:' + path.join(root, 'components/app/routes/products/routes/new'));
  expect(code).toMatch(/export const children = \[child0, child1\]/);
});

test('a route without render, an ambiguous pattern, and executable metadata fail before the app runs', () => {
  write('components/app/routes/broken/meta.ts', 'export default {};');
  expect(() => scanRoutes(root)).toThrow('needs render.tsx');
  rmSync(path.join(root, 'components/app/routes/broken'), { recursive: true });
  route('components/app/routes/products/routes/:other');
  expect(() => scanRoutes(root)).toThrow('ambiguous route');
  rmSync(path.join(root, 'components/app/routes/products/routes/:other'), { recursive: true });
  write('components/app/routes/products/meta.ts', 'export default makeRoute();');
  expect(() => scanRoutes(root)).toThrow('literal object');
});

test('static paths get the page, and the optional dynamic fallback is a separate file', () => {
  const pages = staticPages(scanRoutes(root), '<html>page</html>') as { fileName: string; source: string }[];
  expect(pages.map(({ fileName }) => fileName)).toEqual([
    'products/new/index.html',
    'products/index.html',
    'routing-fallback/404.html',
  ]);
  expect(pages.at(-1)?.source).toContain('Optional History fallback');
  expect(pages.some(({ fileName }) => fileName === '404.html' || fileName.includes(':id'))).toBe(false);
});

test('the plugin loads source in colon folders without relaxing the development server filesystem policy', () => {
  write('components/app/routes/products/routes/:id/props.ts', 'export default () => ({ allowed: true });');
  const plugin = framework({ cwd: root, root: '.', runtime: 'runtime.ts' });
  const file = path.join(root, 'components/app/routes/products/routes/:id/props.ts');
  const addWatchFile = vi.fn();
  expect(plugin.load.call({ addWatchFile }, file)).toBe('export default () => ({ allowed: true });');
  expect(addWatchFile).toHaveBeenCalledWith(file);
  expect(plugin.load.call({ addWatchFile }, '/outside/routes/:id/props.ts')).toBeNull();
});
