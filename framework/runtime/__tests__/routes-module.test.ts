// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// @ts-expect-error The plugin is plain JavaScript, with no declarations.
import framework, { resolveOptions, writeTypes } from '../../plugin/index.mjs';
// @ts-expect-error The generator is plain JavaScript, with no declarations.
import { addressModule, routeTypes, scanRoutes, staticPages } from '../../plugin/routes.mjs';
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
    test: string;
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

test('a routed chart state adds an address from XState meta, without another chart', () => {
  route('components/bulk');
  write('components/bulk/state.ts', "export default () => ({ editing: {}, confirm: { meta: { route: 'confirm' } } });");
  route('components/app/routes/products/routes/bulk', "{ chart: 'components/bulk' }");
  expect((scanRoutes(root) as Scan).routes.find(({ path }) => path === '/products/bulk/confirm')).toMatchObject({
    chart: { component: 'components/bulk', state: 'confirm' },
  });
});

test('a route reads its own chart without a pointer to another component', () => {
  write(
    'components/app/routes/products/routes/new/state.ts',
    "export default { editing: {}, confirming: { meta: { route: 'confirm' } } };",
  );
  expect((scanRoutes(root) as Scan).routes.find(({ path }) => path === '/products/new/confirm')).toMatchObject({
    chart: { component: 'components/app/routes/products/routes/new', state: 'confirming' },
  });
});

test.each([true, false])('the generated codec validates params and honors the base, with URLPattern: %s', (native) => {
  if (!native) vi.stubGlobal('URLPattern', undefined);
  const code = addressModule(scanRoutes(root), '"framework"', '/framework-demo/') as string;
  const codec = new Function(
    'createCodec',
    code
      .replace(/^import .*\n/, '')
      .replace(/^export \{ createAddress \}.*\n/m, '')
      .replace('export const codec', 'const codec')
      .replace('export default codec;', 'return codec;'),
  )(createCodec) as AddressCodec;
  expect(codec.format('/products/:id/edit', { id: 4 }, { page: 2 })).toMatch(
    /^\/framework-demo\/products\/4\/edit\?query=/,
  );
  expect(codec.parse('/framework-demo/products/4/edit').params).toEqual({ id: 4 });
  expect(codec.parse('/framework-demo-extra/products/4/edit').pattern).toBe('/products');
  expect(codec.match('/products/new')?.route.path).toBe('/products/new');
  expect(() => codec.pathOf('/products/:id/edit', {})).toThrow('Invalid parameter id');
  expect(() => codec.pathOf('/products/:id', { extra: 2, id: 4 })).toThrow('Extra parameter');
});

test('the folder module injects a stable routes element, and its declarations include every pattern and query slice', () => {
  const options = resolveOptions({ cwd: root, root: '.', runtime: 'runtime.ts' });
  writeTypes(options);
  const code = framework(options).load('\0framework-component:' + path.join(root, 'components/app')) as string;
  expect(code).toContain('routes: createElement(Routes, { owner: "components/app" })');
  const types = readFileSync(path.join(root, '.framework-types/routes.d.ts'), 'utf8');
  expect(types).toBe(routeTypes(scanRoutes(root)));
  expect(types).toContain(
    '"/products/:id/edit": { params: { "id": number }; query: { "signin": boolean; "page": number } }',
  );
  expect(types).toContain('ParametersOf<Path');
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
