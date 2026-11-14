// The app built for counting render cycles: react-dom's profiling build (each fiber records its
// render time), unminified, so components keep their names, with the framework counting every
// call of a component's render (`window.__renderCall`), which of those calls React committed
// (`window.__kept`: the rest it threw away), and each time a component is about to suspend: on its
// view, its skin, or its default read (`window.__suspend`). `npm run perf` builds it and drives perf/steps.mjs through it.

import path from 'node:path';
import { mergeConfig, type Plugin } from 'vite';

import base from '../vite.config.ts';

/** Insertions into the runtime's component.tsx, each before an anchor that must be there. */
const EDITS: [anchor: string, before: string][] = [
  ['const rendered = shareElements(', '__call = globalThis.__renderCall?.(spec.path)\n    '],
  // Each element a call returned remembers the call. The layout effect of the render React commits
  // marks the call behind the element it shows: a render React threw away whose output a later
  // render returns again was not wasted, and one whose output nothing shows was.
  [
    'last.current = { allowed, element, inputs, props, rendered, scope, shaped }',
    ';(globalThis.__callOf ??= new WeakMap()).set(element as object, __call)\n    ',
  ],
  [
    'last.current = { ...last.current, inputs, props, shaped }',
    ';(globalThis.__callOf ??= new WeakMap()).set(last.current.element as object, __call)\n      ',
  ],
  [
    'useLayoutEffect(() => commitHandlers(scope))',
    'let __call: unknown\n    useLayoutEffect(() => void globalThis.__kept?.(globalThis.__callOf?.get(last.current?.element as object)))\n    ',
  ],
  [
    'const module = use(loadView())',
    "if (loadView().status !== 'fulfilled') globalThis.__suspend?.(spec.path, 'view')\n    ",
  ],
  [
    'if (loadThisSkin) use(loadSkin(',
    "if (loadThisSkin && loadSkin(spec.path, skin, loadThisSkin).status !== 'fulfilled') globalThis.__suspend?.(spec.path, 'skin')\n    ",
  ],
  [
    'const answer: unknown = query ? useSuspenseQuery(',
    "if (query && __client.getQueryData(query.queryKey) === undefined) globalThis.__suspend?.(spec.path, 'data')\n    ",
  ],
  ['const parent = use(ScopeContext);\n    const scope', 'const __client = useQueryClient()\n    '],
];

const countRenders: Plugin = {
  enforce: 'pre',
  name: 'perf:count-renders',
  transform(code, id) {
    if (!id.endsWith('/framework/runtime/component.tsx')) return null;
    const imports = '  useQueryErrorResetBoundary,\n';
    if (!code.includes(imports))
      throw new Error(`perf: component.tsx no longer has \`${imports}\`; update perf/vite.config.ts`);
    let patched = code.replace(imports, '  useQueryClient,\n  useQueryErrorResetBoundary,\n');
    for (const [anchor, before] of EDITS) {
      if (!patched.includes(anchor))
        throw new Error(`perf: component.tsx no longer has \`${anchor}\`; update perf/vite.config.ts`);
      patched = patched.replace(anchor, `${before}${anchor}`);
    }
    return patched;
  },
};

export default mergeConfig(base, {
  base: '/',
  build: { emptyOutDir: true, minify: false, outDir: path.resolve(import.meta.dirname, 'dist') },
  plugins: [countRenders],
  resolve: { alias: [{ find: /^react-dom\/client$/, replacement: 'react-dom/profiling' }] },
});
