// The convention checks: every component is a component folder's render (or placeholder, or
// error), one component per file, so the plugin tracks every handler.
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const { declaredProps, operationsOf, problems, readsOf } = require('./folders.cjs');

let root;
const write = (relative, text) => {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const about = (prefix) => problems(root).filter((problem) => problem.file.startsWith(prefix));

before(() => {
  root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'framework-folders-')));
  write(
    'components/clean/render.tsx',
    'export default ({ items }) => <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>;\n',
  );
  write('components/clean/placeholder.tsx', 'export default () => <p>Loading</p>;\n');
  write('components/named/render.tsx', 'const View = () => <div />;\nexport default View;\n');
  write(
    'components/alias/render.tsx',
    "import { Up, Down } from 'icons';\nexport default ({ open }) => {\n  const Icon = open ? Up : Down;\n  return <Icon />;\n};\n",
  );
  write(
    'components/second/render.tsx',
    'const Row = () => <tr />;\nexport default () => (\n  <table>\n    <Row />\n  </table>\n);\n',
  );
  write('components/nested/render.tsx', 'export default () => {\n  const Row = () => <tr />;\n  return <Row />;\n};\n');
  write(
    'components/helper/render.tsx',
    'const cell = (value) => <td>{value}</td>;\nexport default () => <tr>{cell(1)}</tr>;\n',
  );
  write('components/cells.tsx', 'export const Cell = () => <td />;\n');
  write('components/folder/render/index.tsx', 'export default () => <div />;\n');
  write('services/demo/index.tsx', 'export const list = () => () => Promise.resolve(<div />);\n');
  write('services/demo/types.ts', 'export type Item = { id: string };\n');
});

after(() => rmSync(root, { force: true, recursive: true }));

const operationFields = ['pending', 'error', 'data', 'actor'];

const operationFixture = (name, render, async = 'export const save = () => {}; export const remove = () => {};') => {
  write(`components/${name}/render.tsx`, render);
  write(`components/${name}/async.ts`, async);

  return () => operationsOf(root, path.join(root, 'components', name));
};

test('commands, pending and actor reads have distinct fixed manifests', () => {
  for (const [name, render, fields] of [
    ['command', '({ async: { save } }) => save', []],
    ['pending', '({ status }) => status.save.pending', ['pending']],
    ['actor', '({ status }) => status.save.actor', ['actor']],
  ]) {
    const manifest = operationFixture(name, `export default ${render};`);
    assert.deepEqual(manifest(), { names: ['remove', 'save'], status: { remove: [], save: fields } });
  }
});

test('status aliases and default bindings select fields in canonical order without duplicates', () => {
  const manifest = operationFixture(
    'status-aliases',
    `export default ({ status: current = {} } = {}) =>
      [current.save.actor, current.save.data.title, current?.save?.pending, current.save.data];`,
  );

  assert.deepEqual(manifest().status, { remove: [], save: ['pending', 'data', 'actor'] });
  write(
    'components/status-aliases/handlers.ts',
    `export const retry = ({ status: { save: result = {} } }) => () => result.error;
     export const show = ({ status: { save: { pending: busy = false } = {} } = {} }) => () => busy;`,
  );
  assert.deepEqual(manifest(), {
    names: ['remove', 'save'],
    status: { remove: [], save: operationFields },
  });
});

test('whole, rest, computed and unsupported status reads fall back to the nearest whole shape', () => {
  for (const expression of [
    '({ status }) => status',
    '({ ...given }) => given',
    '(given) => given.status.save.pending',
    '({ [key]: value }) => value',
    '({ status }) => status[key].pending',
    '({ status: { ...results } }) => results',
  ]) {
    assert.deepEqual(operationFixture('status-broad', `export default ${expression};`)().status, {
      remove: operationFields,
      save: operationFields,
    });
  }

  for (const expression of [
    '({ status }) => status.save',
    '({ status }) => status.save[key]',
    '({ status }) => status.save.unknown',
    '({ status: { save: { ...result } } }) => result',
    '({ status: { save: { [key]: value } } }) => value',
    '({ status: { save: [value] } }) => value',
    '({ status: { save: result } }) => consume(result)',
    '({ status }) => { const result = status.save; return result.pending; }',
  ]) {
    assert.deepEqual(operationFixture('status-broad-operation', `export default ${expression};`)().status, {
      remove: [],
      save: operationFields,
    });
  }
});

test('only the observing layers contribute status, and a shaped render is excluded', () => {
  const manifest = operationFixture('status-layers', 'export default ({ status }) => status.save.actor;');
  write('components/status-layers/props.ts', 'export default ({ status }) => status.save.pending;');
  write('components/status-layers/handlers.ts', 'export const retry = ({ status }) => () => status.save.error;');
  write('components/status-layers/shortcuts.ts', 'export default ({ status }) => status.save.data;');
  write('components/status-layers/acl.ts', 'export default ({ status }) => status.remove.pending;');
  write('components/status-layers/state.ts', 'export const check = ({ status }) => status.remove.actor;');
  write('components/status-layers/form.ts', 'export const seed = ({ status }) => status.remove.error;');
  assert.deepEqual(manifest(), {
    names: ['remove', 'save'],
    status: { remove: ['pending'], save: ['pending', 'error', 'data'] },
  });
});

test('export names are sorted values, including aliases, while default stays a query', () => {
  const manifest = operationFixture(
    'status-exports',
    'export default () => null;',
    `const store = () => {}; export { store as save, store as again, store as default };
     export function remove() {};
     export type Value = string;
     export { type Other, work as remote } from './elsewhere';`,
  );

  write(
    'components/status-exports/props.ts',
    `const shape = ({ status: { save: { pending: busy } } }) => busy;
     export { shape as default };
     export const helper = ({ status }) => status.remove.actor;`,
  );
  assert.deepEqual(manifest(), {
    names: ['again', 'remote', 'remove', 'save'],
    status: { again: [], remote: [], remove: [], save: ['pending'] },
  });
});

test('missing, empty and default-only async layers own no operations', () => {
  for (const source of ['', 'export default () => Promise.resolve([]);']) {
    assert.deepEqual(operationFixture('status-empty', 'export default (given) => given;', source)(), {
      names: [],
      status: {},
    });
  }

  assert.deepEqual(operationsOf(root, path.join(root, 'components/clean')), { names: [], status: {} });
});

test('unresolved observers are broad, while source props are left for their own contract', () => {
  const manifest = operationFixture('status-unresolved', 'export default imported;');
  assert.deepEqual(manifest().status, { remove: operationFields, save: operationFields });
  write('components/status-unresolved/render.tsx', 'export default ({ busy }) => busy.pending;');
  assert.deepEqual(manifest().status, { remove: [], save: [] });
});

test('the plugin serializes status metadata and connects its generated execution', async () => {
  const { default: framework } = await import('../plugin/index.mjs');
  operationFixture('status-manifest', 'export default ({ status }) => status.save.pending;');
  const plugin = framework({ cwd: root, root: '.', runtime: 'runtime.ts' });
  const dir = path.join(root, 'components/status-manifest');
  const code = plugin.load(`\0framework-component:${dir}`);
  const manifest = JSON.parse(/  reads: (.*),\n/.exec(code)[1]);
  assert.deepEqual(manifest, {
    acl: [],
    async: [],
    chart: [],
    operations: { names: ['remove', 'save'], status: { remove: [], save: ['pending'] } },
    state: [],
    view: [],
  });
  const view = plugin.load(`\0framework-view:${dir}`);
  assert.equal((view.match(/ = useOperation\(/g) ?? []).length, 2);
  assert.equal((view.match(/ = useSelector\(/g) ?? []).length, 1);
  assert.match(view, /export \* as async from/);
});

test('a status-only edit invalidates the serialized manifest even when top-level reads stay equal', async () => {
  const { default: framework } = await import('../plugin/index.mjs');
  operationFixture('status-edit', 'export default ({ status }) => status.save.pending;');
  const plugin = framework({ cwd: root, root: '.', runtime: 'runtime.ts' });
  const dir = path.join(root, 'components/status-edit');
  const id = `\0framework-component:${dir}`;
  const before = plugin.load(id);
  const listeners = new Map();
  const invalidated = [];
  let reload;

  const reloaded = new Promise((resolve) => {
    reload = resolve;
  });

  plugin.configureServer({
    config: { logger: { warn() {} } },
    environments: {
      client: {
        hot: { send: reload },
        moduleGraph: {
          getModuleById: (id) => id,
          idToModuleMap: new Map(),
          invalidateModule: (mod) => invalidated.push(mod),
        },
      },
    },
    watcher: { add() {}, on: (event, callback) => listeners.set(event, callback) },
  });
  const file = path.join(dir, 'render.tsx');
  listeners.get('change')(file);
  assert.deepEqual(invalidated, []);
  write('components/status-edit/render.tsx', 'export default ({ status }) => status.save.error;');
  listeners.get('change')(file);
  assert.deepEqual(invalidated, [id]);
  assert.match(plugin.load(id), /"save":\["error"\]/);
  assert.match(before, /"save":\["pending"\]/);
  await reloaded;
});

test('a component folder whose rendering files each hold one component passes', () => {
  assert.deepEqual(about('components/clean'), []);
  assert.deepEqual(about('components/named'), []);
  assert.deepEqual(about('components/alias'), []);
});

test('a second component beside the default export is named, with its line', () => {
  const found = about('components/second');
  assert.deepEqual(
    found.map((problem) => problem.file),
    ['components/second/render.tsx:1', 'components/second/render.tsx:4'],
  );
  assert.match(found[0].message, /JSX outside the default export \(Row\)/);
  assert.match(found[1].message, /<Row>, a component declared in this file/);
});

test('a component declared inside the render, and rendered, is a second component', () => {
  assert.deepEqual(
    about('components/nested').map((problem) => problem.file),
    ['components/nested/render.tsx:3'],
  );
});

test('JSX in a helper outside the default export is named too', () => {
  assert.deepEqual(
    about('components/helper').map((problem) => problem.file),
    ['components/helper/render.tsx:1'],
  );
});

test('JSX outside a component folder, or in a render grown into a folder, is named', () => {
  assert.deepEqual(about('components/cells.tsx').length, 1);
  assert.match(about('components/cells.tsx')[0].message, /handlers are not tracked/);
  assert.deepEqual(about('components/folder/render').length, 1);
  assert.deepEqual(
    about('services/demo').map((problem) => problem.file),
    ['services/demo/index.tsx'],
  );
});

test('a props file that exports a type named Props states what a parent passes', () => {
  write('components/typed/render.tsx', 'export default ({ label }) => <p>{label}</p>;\n');
  write(
    'components/typed/props.ts',
    'export type Props = { label: string }\nexport default ({ label }) => ({ label });\n',
  );
  write('components/untyped/render.tsx', 'export default ({ label }) => <p>{label}</p>;\n');
  write(
    'components/untyped/props.ts',
    'type Props = { label: string }\nexport default ({ label }: Props) => ({ label });\n',
  );
  assert.equal(declaredProps(path.join(root, 'components/typed')), path.join(root, 'components/typed/props.ts'));
  assert.equal(declaredProps(path.join(root, 'components/untyped')), null);
  assert.equal(declaredProps(path.join(root, 'components/clean')), null);
});

test('an inline event function in any render is a mistake: it belongs in handlers.ts', () => {
  write('components/with-handlers/handlers.ts', 'export const press = () => () => {};\n');
  write(
    'components/with-handlers/render.tsx',
    'export default () => <><Button onPress={() => {}} onClick={function () {}} className={() => "x"} /></>;\n',
  );
  write('components/without-handlers/render.tsx', 'export default () => <Button onPress={() => {}} />;\n');
  const found = about('components/with-handlers');
  assert.equal(found.length, 2);
  assert.deepEqual(
    found.map((problem) => problem.file),
    ['components/with-handlers/render.tsx:1', 'components/with-handlers/render.tsx:1'],
  );
  assert.ok(found.every((problem) => problem.message.includes('handlers.ts')));
  const without = about('components/without-handlers');
  assert.equal(without.length, 1);
  assert.ok(without[0].message.includes('handlers.ts'));
});

test('named handlers count as reads even when props.ts shapes the render', () => {
  write('components/handler-reads/render.tsx', 'export default ({ press }) => <Button onPress={press} />;\n');
  write('components/handler-reads/props.ts', 'export default () => ({ label: "Press" });\n');
  write('components/handler-reads/handlers.ts', 'export const press = ({ user, route }) => () => [user, route];\n');
  const reads = readsOf(root, path.join(root, 'components/handler-reads'));
  assert.deepEqual(reads.byLayer.handlers, ['user', 'route']);
  assert.deepEqual(reads.names.handlers, ['route', 'user']);
});

test('handler exports name the action, not the event', () => {
  write('components/handler-names/render.tsx', 'export default () => <p />;\n');
  write(
    'components/handler-names/handlers.ts',
    'export const onPress = () => () => {};\nexport function handleClick() { return () => {}; }\nconst move = () => () => {};\nexport { move as onChange };\nexport const goTo = () => () => {};\n',
  );
  const found = about('components/handler-names');
  assert.deepEqual(
    found.map((problem) => problem.file),
    [
      'components/handler-names/handlers.ts:1',
      'components/handler-names/handlers.ts:2',
      'components/handler-names/handlers.ts:4',
    ],
  );
  assert.ok(found.every((problem) => problem.message.includes('name it for what it does')));
});

test('a handler whose dependencies cannot be read is named, with what to write', () => {
  write('components/handler-reads-all/render.tsx', 'export default () => <p />;\n');
  write(
    'components/handler-reads-all/handlers.ts',
    [
      'export const passOn = (given) => () => given.state.send({ type: "go" });',
      'export const rest = ({ state, ...others }) => () => others;',
      'export const made = make("next");',
      'export { other } from "./other";',
      'export const fine = ({ state: { send } }) => () => send({ type: "go" });',
      'export const none = () => () => {};',
      '',
    ].join('\n'),
  );
  const found = about('components/handler-reads-all');
  assert.deepEqual(
    found.map((problem) => problem.file),
    [1, 2, 3, 4].map((line) => `components/handler-reads-all/handlers.ts:${line}`),
  );
  assert.match(found[0].message, /handler passOn takes a parameter that is not destructured/);
  assert.match(found[1].message, /handler rest takes the rest of what it is given/);
  assert.match(found[2].message, /handler made is not a function written in this file/);
  assert.ok(found.every((problem) => problem.message.includes('destructuring what it uses')));
});

test("a folder's element gets its boundaries only as a JSX tag of a default import: any other use is named", () => {
  write('components/page/components/row/render.tsx', 'export default () => <li />;\n');
  write('components/page/components/other/render.tsx', 'export default () => <li />;\n');
  write(
    'components/page/render.tsx',
    [
      "import Row from './components/row';",
      "import Other from '@/components/page/components/other';",
      "import { Up, Down } from 'icons';",
      "import type Typed from './components/row';",
      'export default ({ items, open, wide }) => {',
      '  const Icon = open ? Up : Down;',
      '  return (',
      '    <ul>',
      '      {wide ? <Row /> : <Other>text</Other>}',
      '      {items.map((item) => <Row key={item} />)}',
      '      <Icon side={<Row />} />',
      '    </ul>',
      '  );',
      '};',
      '',
    ].join('\n'),
  );
  assert.deepEqual(about('components/page'), []);

  write(
    'components/values/render.tsx',
    [
      "import { createElement } from 'react';",
      "import Row from '../page/components/row';",
      "import Other from '../page/components/other';",
      "import { default as Named } from '../page/components/row';",
      "import * as All from '../page/components/other';",
      "import { Box } from 'library';",
      'export default ({ wide }) => {',
      '  const Chosen = wide ? Row : Other;',
      '  return (',
      '    <Box as={Row} slots={{ row: Other }}>',
      '      <Chosen />',
      '      {createElement(Row, { id: 1 })}',
      '    </Box>',
      '  );',
      '};',
      '',
    ].join('\n'),
  );
  const found = about('components/values');
  assert.deepEqual(
    found.map((problem) => problem.file),
    [4, 5, 8, 8, 10, 10, 12].map((line) => `components/values/render.tsx:${line}`),
  );
  assert.match(found[0].message, /imports the component .* by another name than its default/);
  assert.match(found[2].message, /uses the component Row as a value: write it as a JSX tag, `<Row … \/>`/);

  write('components/shaped/render.tsx', 'export default ({ row }) => <ul>{row}</ul>;\n');
  write(
    'components/shaped/props.ts',
    "import Row from '../page/components/row';\nexport default () => ({ row: Row });\n",
  );
  write('components/shaped/style/skins/plain/index.ts', "import Row from '../../../../page/components/row';\n");
  const shaped = about('components/shaped');
  assert.deepEqual(
    shaped.map((problem) => problem.file),
    ['components/shaped/props.ts:1'],
  );
  assert.match(shaped[0].message, /a component is written in a render, placeholder or error file, as a JSX tag/);
});
