// @vitest-environment node
// @ts-expect-error The plugin is plain JavaScript, with no declarations.

import { transformRender, transformShell } from '../../plugin/index.mjs';

// The folders a render imports: here, every relative import.
const isFolder = (source: string) => source.startsWith('./components/');
const transform = (code: string) =>
  (
    transformRender(
      code,
      '/src/components/list/render.tsx',
      'components/list',
      'components/list/render.tsx',
      '"framework"',
      false,
      isFolder,
    ) as null | { code: string }
  )?.code ?? code;

test("a folder's element gets its boundaries where a render writes it: among children in braces, elsewhere as it is", () => {
  const code = transform(`
import Row from './components/row'
import { Box } from 'library'
export default ({ className, open, row }) => (
  <Box className={className} side={<Row id="side" />}>
    <Row id={row} />
    {open && <Row id="open" key="open">text</Row>}
  </Box>
)`);
  expect(code).toContain('import { bound as __bound } from "framework";');
  expect(code).toContain('side={__bound(<Row id="side" />)}');
  expect(code).toContain('{__bound(<Row id={row} />)}');
  expect(code).toContain('{open && __bound(<Row id="open" key="open">text</Row>)}');
  // An element of anything else stays as written.
  expect(code).toContain('<Box className={className}');
  expect(code).not.toContain('__bound(<Box');
});

test('a function moved out of the render, and one kept in it, take the boundaries along', () => {
  const code = transform(`
import Row from './components/row'
import { List } from 'library'
export default ({ items, selected }) => (
  <List items={items}>{(item) => <Row item={item} />}</List>
)
export const other = ({ items, selected }) => (
  <List items={items}>{(item) => <li><Row item={item} selected={selected} /><Row item={item} /></li>}</List>
)`);
  expect(code).toContain('const __constant_0 = (item) => __bound(<Row item={item} />);');
  expect(code).toContain('<List items={items}>{__constant_0}</List>');
  expect(code).toContain(
    '{__keep((item) => <li>{__bound(<Row item={item} selected={selected} />)}{__bound(<Row item={item} />)}</li>, [selected],',
  );
});

test('a file that writes no folder is not given the import', () => {
  const code = transform(`
import { Box } from 'library'
export default ({ className, onPress }) => <Box className={className} onPress={onPress} />`);
  expect(code).not.toContain('__bound');
});

test('an element given as an attribute with no braces gets them', () => {
  const code = transform(`
import Row from './components/row'
import { Box } from 'library'
export default () => <Box side=<Row /> />`);
  expect(code).toContain('<Box side={__bound(<Row />)} />');
});

test("a file that is not a folder's (the shell, where Root is given its folders) gets the boundaries wherever it writes a folder", () => {
  const shell = (code: string) =>
    (transformShell(code, '/src/main.tsx', '"framework"', isFolder) as null | { code: string })?.code ?? code;
  const code = shell(`
import { Root } from 'framework'
import App from './components/app'
import Layout from './layout'
export const Shell = ({ onPress }) => (
  <Root>
    <Layout onPress={onPress}>
      <>
        <div><App wide /></div>
      </>
    </Layout>
  </Root>
)`);
  expect(code).toContain('import { bound as __bound } from "framework";');
  expect(code).toContain('<div>{__bound(<App wide />)}</div>');
  // Nothing else of the file is touched: its handlers are its own.
  expect(code).toContain('<Layout onPress={onPress}>');
  expect(shell("import { Root } from 'framework'\nexport const Shell = () => <Root><p /></Root>")).not.toContain(
    '__bound',
  );
});
