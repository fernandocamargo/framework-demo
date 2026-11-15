// The convention checks: every component is a component folder's render (or placeholder, or
// error), one component per file, so the plugin tracks every handler.
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const { declaredProps, problems, readsOf } = require('./folders.cjs');

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
