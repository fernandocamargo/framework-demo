// @vitest-environment node

import { ESLint } from 'eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// @ts-expect-error The plugin is plain JavaScript, with no declarations.
import framework, { operationsModule } from '../../plugin/index.mjs';
// @ts-expect-error The shared folder reader is plain JavaScript, with no declarations.
import folders from '../../shared/folders.cjs';

type Manifest = { names: string[]; status: Record<string, string[]> };

const generated = (manifest: Manifest): string => operationsModule(manifest, '"framework"');

test('absent, empty and default-only layers generate no operation hooks in either composition', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'framework-operations-'));
  const dir = path.join(cwd, 'src/components/plain');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'render.tsx'), 'export default () => <p />;');

  try {
    for (const command of ['serve', 'build']) {
      const plugin = framework({ cwd, root: 'src', runtime: path.resolve('framework/runtime/index.ts') });
      plugin.configResolved({ command });

      for (const source of [undefined, '', 'export default () => Promise.resolve("answer");']) {
        if (source !== undefined) writeFileSync(path.join(dir, 'async.ts'), source);
        else rmSync(path.join(dir, 'async.ts'), { force: true });
        const code: string = plugin.load.call({ addWatchFile: () => undefined }, `\0framework-view:${dir}`);
        expect(code).toContain('export const useOperations = undefined;');
        expect(code).not.toContain('useOperation(');
        expect(code).not.toContain('useSelector(');
      }
    }
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test('the view module emits the manifest as literal native hooks and a signature for every field', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'framework-operations-'));
  const dir = path.join(cwd, 'src/components/reader');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'render.tsx'), 'export default ({ status }) => <p>{status.save.pending}</p>;');
  writeFileSync(
    path.join(dir, 'async.ts'),
    'export const save = () => Promise.resolve(1); export const erase = () => Promise.resolve();',
  );

  try {
    const plugin = framework({ cwd, root: 'src', runtime: path.resolve('framework/runtime/index.ts') });
    const code: string = plugin.load.call({ addWatchFile: () => undefined }, `\0framework-view:${dir}`);
    const manifest = { names: ['erase', 'save'], status: { erase: [], save: ['pending'] } };
    expect(code).toContain(operationsModule(manifest, JSON.stringify(path.resolve('framework/runtime/async.ts'))));
    expect(code.match(/ = useOperation\(/g)).toHaveLength(2);
    expect(code.match(/ = useSelector\(/g)).toHaveLength(1);
    expect(code).toContain('snapshot.matches("pending")');
    expect(code).toContain('export * as async from');

    const signatures = [[], ['actor'], ['pending'], ['data'], ['error']].map(
      (fields) =>
        /export const operationSignature = (.*);/.exec(generated({ names: ['save'], status: { save: fields } }))![1],
    );

    expect(new Set(signatures).size).toBe(signatures.length);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test('watcher edits explicitly reload before the app-folder filter; ordinary edits only invalidate the view', () => {
  const runtime = path.resolve('framework/runtime/index.ts');
  const plugin = framework({ root: 'src', runtime });
  const send = vi.fn();
  const invalidateModule = vi.fn();

  const context = {
    environment: { hot: { send }, moduleGraph: { getModuleById: (id: string) => ({ id }), invalidateModule } },
  };

  expect(plugin.hotUpdate.call(context, { file: path.resolve('framework/runtime/latency.ts') })).toEqual([]);
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'full-reload' });
  send.mockClear();
  plugin.hotUpdate.call(context, { file: path.resolve('src/components/lab/async.ts') });
  expect(send).not.toHaveBeenCalled();
  expect(invalidateModule).toHaveBeenCalledTimes(2);
});

test('generated operations obey native hook order and dependencies for all seven app exports', async () => {
  const eslint = new ESLint({
    overrideConfig: [
      {
        files: ['**/*.js'],
        plugins: { 'react-hooks': { rules: reactHooks.rules } },
        rules: {
          'react-hooks/exhaustive-deps': 'error',
          'react-hooks/rules-of-hooks': 'error',
        },
      },
    ],
    overrideConfigFile: true,
  });

  const root = path.resolve('src');
  let count = 0;
  let selectors = 0;

  for (const dir of folders.listComponentFolders(root)) {
    const manifest: Manifest = folders.operationsOf(root, dir);
    const code = generated(manifest);
    count += manifest.names.length;
    selectors += (code.match(/ = useSelector\(/g) ?? []).length;
    const [result] = await eslint.lintText(code, { filePath: path.join(dir, 'operations.js') });
    expect(result?.messages, dir).toEqual([]);
  }

  expect([count, selectors]).toEqual([7, 2]);
});
