// @vitest-environment node
// @ts-expect-error The plugin is plain JavaScript, with no declarations.

import { transformRender } from '../../plugin/index.mjs';

const transformed = (code: string) =>
  (
    transformRender(
      code,
      '/src/components/list/render.tsx',
      'components/list',
      'components/list/render.tsx',
      '"framework"',
    ) as null | { code: string }
  )?.code ?? code;
// The site of a kept function is where it is written; these tests name it SITE.
const transform = (code: string) => transformed(code).replace(/"components\/list@\d+:\d+"/g, 'SITE');

test('a function in the JSX that uses nothing of the render moves out of it, so it is the same at every render', () => {
  const code = transform(`
import { ListBox, ListBoxItem } from 'react-aria-components'
export default ({ className, items }) => (
  <ListBox className={className} items={items}>{(item) => <ListBoxItem id={item.slug}>{item.name}</ListBoxItem>}</ListBox>
)`);
  expect(code).toContain('const __constant_0 = (item) => <ListBoxItem id={item.slug}>{item.name}</ListBoxItem>;');
  expect(code).toContain('<ListBox className={className} items={items}>{__constant_0}</ListBox>');
});

test('an attribute that is not a handler moves out too; a handler stays, tracked', () => {
  const code = transform(`
export default ({ send }) => <Tab className={({ isSelected }) => (isSelected ? 'on' : 'off')} onPress={() => send({ type: 'open' })} />`);
  expect(code).toContain("const __constant_0 = ({ isSelected }) => (isSelected ? 'on' : 'off');");
  expect(code).toContain('className={__constant_0}');
  expect(code).toContain("onPress={__track(() => send({ type: 'open' }), __site_0)}");
});

test('a function that reads values of the render is kept while they are the same, by site and key', () => {
  const uses = transform(`
export default ({ latencyText }) => <SliderOutput>{({ state }) => latencyText(state.getThumbValue(0))}</SliderOutput>`);
  expect(uses).toContain('import { keep as __keep } from "framework";');
  expect(uses).toContain(
    '<SliderOutput>{__keep(({ state }) => latencyText(state.getThumbValue(0)), [latencyText], SITE)}</SliderOutput>',
  );

  // What a list's callback binds is the render's too; the row's key tells the kept functions apart.
  const inList = transform(`
export default ({ rows }) => <ul>{rows.map((row) => <Row key={row.id}>{(cell) => <Cell row={row.id} cell={cell} />}</Row>)}</ul>`);
  expect(inList).toContain('{__keep((cell) => <Cell row={row.id} cell={cell} />, [row], SITE, row.id)}');

  // A `const` of the render, declared before the function.
  const local = transform(`
export default ({ rows }) => {
  const label = rows.length
  return <Rows>{() => <b>{label}</b>}</Rows>
}`);
  expect(local).toContain('{__keep(() => <b>{label}</b>, [label], SITE)}');
});

test('a function that reads a `let` of the render stays as written: the value it reads may change after it', () => {
  const variable = `
export default ({ rows }) => {
  let label = rows.length
  return <Rows>{() => <b>{label}</b>}</Rows>
}`;
  expect(transform(variable)).toBe(variable);
});

test('a function that binds a name of the render again, uses `this`, or holds a handler stays', () => {
  const shadows = `
export default ({ item }) => <List>{(item) => <b>{item}</b>}</List>`;
  expect(transform(shadows)).toBe(shadows);

  const handler = `
export default ({ items }) => <List items={items}>{(item) => <Item onAction={() => item.open()} />}</List>`;
  expect(transform(handler)).toContain(
    '<List items={items}>{(item) => <Item onAction={__track(() => item.open(), __site_0)} />}</List>',
  );
});

test('what the module imports or declares, and globals, are not of the render', () => {
  const code = transform(`
import { format } from '@/format'
const UNIT = 'ms'
export default ({ value }) => <Output value={value}>{({ state }) => <b>{format(Number(state.value))} {UNIT}</b>}</Output>`);
  expect(code).toContain('const __constant_0 = ({ state }) => <b>{format(Number(state.value))} {UNIT}</b>;');
});

test('a kept function is the one of the last render that read the same values, at its place', async () => {
  const { keep, withScope } = await import('../track');
  const scope = { parent: null, path: 'components/list' };
  const render = (formatter: unknown, rows: string[]) =>
    withScope(scope, () => rows.map((row) => keep(() => [formatter, row], [formatter, row], 'components/list@1:1')));
  const format = () => '';
  const first = render(format, ['a', 'b']);
  const same = render(format, ['a', 'b']);
  expect(same[0]).toBe(first[0]);
  expect(same[1]).toBe(first[1]);
  // Another value at a place: a new function there, the other kept.
  const changed = render(format, ['a', 'c']);
  expect(changed[0]).toBe(first[0]);
  expect(changed[1]).not.toBe(first[1]);
  // Outside an instance (a placeholder), it is the function as written.
  const written = () => 1;
  expect(keep(written, [], 'components/list@1:1')).toBe(written);
});
