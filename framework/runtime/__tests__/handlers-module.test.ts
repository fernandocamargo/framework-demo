// @vitest-environment node

import { ESLint } from 'eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tseslint from 'typescript-eslint';

// @ts-expect-error The plugin is plain JavaScript, with no declarations.
import { handlersModule, transformRender } from '../../plugin/index.mjs';

// The hook the plugin writes from a handlers.ts: what each export depends on, and what it is given.
const generated = (source: string): string =>
  handlersModule(source, '/src/components/sample/handlers.ts', {
    path: 'components/sample',
    relative: 'components/sample/handlers.ts',
    runtime: '"framework"',
  });
/** The dependency list of a handler's callback, and the argument its export is called with. */
const wiring = (source: string, name: string) => {
  const code = generated(source);
  const callback = code.slice(code.indexOf(`const ${name} = useCallback(`));
  return {
    argument: /exported\.\w+\((.*)\);/.exec(callback)?.[1],
    code,
    dependencies: /\n {4}\[(.*)\],\n/.exec(callback)?.[1],
  };
};

test('a member of the chart is the dependency, read into a local before the callback', () => {
  const { argument, code, dependencies } = wiring(
    `export const goTo = ({ state }) => ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) =>
  state.send({ type: 'to', value });`,
    'goTo',
  );
  expect(code).toContain('  const state_send = given.state?.send;\n  // goTo reads state.send.\n');
  expect(argument).toBe('{ state: { send: state_send } }');
  expect(dependencies).toBe('scope, state_send');
  expect(code).toContain('return useMemo(() => ({ goTo }), [goTo]);');
});

test('nested destructuring and another name for the source give the same dependency', () => {
  const source = `
export const nested = ({ state: { send } }) => () => send({ type: 'go' });
export const renamed = ({ state: chart }) => () => chart.send({ type: 'go' });
export const optional = ({ state }) => () => state?.send({ type: 'go' });`;
  for (const name of ['nested', 'renamed', 'optional']) {
    expect(wiring(source, name).argument).toBe('{ state: { send: state_send } }');
    expect(wiring(source, name).dependencies).toBe('scope, state_send');
  }
  // One local for the three of them.
  expect(generated(source).match(/const state_send = /g)).toHaveLength(1);
});

test("the form's functions are members; its values are its store, read when the handler runs", () => {
  const source = `
export const rename = ({ form }) => (value: string) => form.set('title', value);
export const submit = ({ async, form }) => () => async.save(form.values);`;
  expect(wiring(source, 'rename').argument).toBe('{ form: { set: form_set } }');
  expect(wiring(source, 'rename').dependencies).toBe('scope, form_set');
  const submit = wiring(source, 'submit');
  expect(submit.argument).toBe('{ async: { save: async_save }, form }');
  expect(submit.dependencies).toBe('scope, async_save, form');
  expect(submit.code).toContain('// It reads form: its store, read when the handler runs.');
});

test("the app's own values are dependencies as they are, not member by member", () => {
  const source = `
export const fillIn = ({ account, fill }) => () => fill(account.username);
export const open = ({ navigation, services, entity }) => (id: string) =>
  services.products.get(id).then(() => navigation.go({ entity: entity.id, id }));`;
  expect(wiring(source, 'fillIn').argument).toBe('{ account, fill }');
  expect(wiring(source, 'fillIn').dependencies).toBe('scope, account, fill');
  expect(wiring(source, 'open').argument).toBe('{ navigation, services, entity }');
  expect(wiring(source, 'open').dependencies).toBe('scope, navigation, services, entity');
});

test('a source read by a computed name, or passed on, is a dependency whole, and the code says so', () => {
  const source = `
export const toggle = ({ flags }) => (name: string) => flags[name];
export const log = ({ state }) => () => console.log(state);
export const pick = ({ state }) => (name: string) => state.context[name];
export const spread = ({ acl: { ...all } }) => () => all;`;
  expect(wiring(source, 'toggle').argument).toBe('{ flags }');
  expect(wiring(source, 'toggle').code).toContain('// It reads flags whole: it is read by a computed name.');
  expect(wiring(source, 'log').dependencies).toBe('scope, state');
  expect(wiring(source, 'log').code).toContain('// It reads state whole: it is passed on, or used as a value.');
  // The nearest member the source names.
  expect(wiring(source, 'pick').argument).toBe('{ state: { context: state_context } }');
  expect(wiring(source, 'spread').argument).toBe('{ acl }');
});

test('a member read of a source another handler takes whole stays a member for the one that reads it', () => {
  const source = `
export const whole = ({ route }) => () => ({ ...route });
export const field = ({ route }) => () => route.page;`;
  expect(wiring(source, 'whole').argument).toBe('{ route }');
  expect(wiring(source, 'field').argument).toBe('{ route: { page: route_page } }');
  expect(generated(source)).toContain('export const route = "whole";');
  expect(generated('export const field = ({ route }) => () => route.page;')).toContain(
    'export const route = "fields";',
  );
});

test('a rest element, or a parameter that is not destructured, depends on everything given', () => {
  const source = `
export const rest = ({ state, ...others }) => () => others;
export const passOn = (given) => () => given.state.send({ type: 'go' });
export { elsewhere } from './elsewhere';`;
  for (const name of ['rest', 'passOn', 'elsewhere']) {
    expect(wiring(source, name).argument).toBe('given');
    expect(wiring(source, name).dependencies).toBe('scope, given');
  }
  expect(generated(source)).toContain('// rest is given everything, since its parameter has a rest element');
  expect(generated(source)).toContain('// passOn is given everything, since its parameter is not destructured');
});

test('a handler that takes nothing depends on nothing; types and the default export are not handlers', () => {
  const source = `
export type Step = 'one' | 'two';
export const ping = () => () => 'pong';
export default {};`;
  const { argument, code, dependencies } = wiring(source, 'ping');
  expect(argument).toBe('{}');
  expect(dependencies).toBe('scope');
  expect(code).toContain('return useMemo(() => ({ ping }), [ping]);');
});

test('names of the generated module are not taken by a handler or a dependency', () => {
  const code = generated(`
export const scope = ({ given, handle }) => () => [given, handle];`);
  expect(code).toContain('const given_ = given.given;');
  expect(code).toContain('const handle_ = given.handle;');
  expect(code).toContain('const scope_ = useCallback(');
  expect(code).toContain('exported.scope({ given: given_, handle: handle_ })');
  expect(code).toContain('return useMemo(() => ({ scope: scope_ }), [scope_]);');
});

test('each callback emits its interaction with the place of its export as the site', () => {
  const code = generated("\nexport const startTour = ({ state }) => () => state.send({ type: 'start' });");
  expect(code).toContain(
    '"element":"handlers","file":"components/sample/handlers.ts","handler":"handlers.startTour","id":"components/sample#handlers.startTour@2:14","line":2,"path":"components/sample","prop":"startTour"',
  );
  expect(code).toContain('interact(sites.startTour, scope, event, () => {');
});

test('in a folder with a handlers.ts, an attribute given handlers.<name> is not wrapped; any other still is', () => {
  const render = 'export default ({ handlers, select }) => <Button onHover={select} onPress={handlers.startTour} />';
  const transform = (wired: boolean) =>
    (
      transformRender(
        render,
        '/src/components/sample/render.tsx',
        'components/sample',
        'components/sample/render.tsx',
        '"framework"',
        wired,
      ) as { code: string }
    ).code;
  expect(transform(true)).toContain('onHover={__track(select, __site_0)} onPress={handlers.startTour} />');
  expect(transform(false)).toContain('onPress={__track(handlers.startTour, __site_1)}');
});

test('the palette input uses a callback with its parent dependency and handler site', () => {
  const folder = 'src/components/palette/components/commands';
  const source = readFileSync(`${folder}/handlers.ts`, 'utf8');
  const rendered = readFileSync(`${folder}/render.tsx`, 'utf8');
  const handler = wiring(source, 'type');

  const transformed = transformRender(
    rendered,
    `/${folder}/render.tsx`,
    'components/palette/components/commands',
    'components/palette/components/commands/render.tsx',
    '"framework"',
    true,
  );

  expect(handler.argument).toBe('{ onType }');
  expect(handler.dependencies).toBe('scope, onType');
  expect(handler.code).toContain('interact(sites.type, scope, event, () => {');
  expect(transformed?.code).toContain('onInputChange={handlers.type}');
  expect(transformed?.code).not.toContain('__track(handlers.type');
});

test('generated handler hooks obey the hooks rules for fixtures and every app folder', async () => {
  const eslint = new ESLint({
    overrideConfig: [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tseslint.parser, sourceType: 'module' },
        plugins: { 'react-hooks': { rules: reactHooks.rules } },
        rules: {
          'react-hooks/exhaustive-deps': 'error',
          'react-hooks/rules-of-hooks': 'error',
        },
      },
    ],
    overrideConfigFile: true,
  });
  const fixtures = [
    'export const renamed = ({ state: chart }) => () => chart.send({ type: "go" });',
    'export const optional = ({ state }) => () => state?.send({ type: "go" });',
    'export const rest = ({ state, ...others }) => () => others;',
    'export const passOn = (given) => () => given.state.send({ type: "go" });',
    "export { elsewhere } from './elsewhere';",
  ];
  const sources = [
    ...fixtures.map((source) => [source, 'src/components/sample/handlers.ts'] as const),
    ...globSync('src/components/**/handlers.ts').map((relative) => [readFileSync(relative, 'utf8'), relative] as const),
  ];
  for (const [source, relative] of sources) {
    const file = resolve(relative);
    const code = handlersModule(source, file, {
      path: relative.slice(4, -'/handlers.ts'.length),
      relative: relative.slice(4),
      runtime: '"framework"',
    });
    const [result] = await eslint.lintText(code, { filePath: file });
    expect(result?.messages, relative).toEqual([]);
  }

  const code = generated('export const goTo = ({ state }) => () => state.send({ type: "go" });');
  const [clean] = await eslint.lintText(code, { filePath: resolve('src/components/sample/handlers.ts') });
  expect(clean?.messages).toEqual([]);
  const bad = code.replace('[scope, state_send]', '[scope]');
  expect(bad).not.toBe(code);
  const [result] = await eslint.lintText(bad, { filePath: resolve('src/components/sample/handlers.ts') });
  expect(result?.messages).toEqual([
    expect.objectContaining({
      message: expect.stringContaining("missing dependency: 'state_send'"),
      ruleId: 'react-hooks/exhaustive-deps',
      severity: 2,
    }),
  ]);
}, 30_000);
