// ESLint orders the code; Prettier lays it out (.prettierrc). Both run on save in VS Code
// (.vscode/settings.json) and in `npm run check`.
//
// - Imports come in three groups, a blank line between them: absolute external (Node's and the
//   packages'), absolute internal (`framework` and `@/…`), and relative.
// - Everything else whose order means nothing is sorted, in natural order: object keys,
//   destructuring, JSX props, named imports and exports, types, union members, switch cases.
// - Order that means something is kept: a chart's states (the first one is where it starts), a
//   component's keys (listed as declared), an object under a comment that says its order matters,
//   the statements of a file, Maps and Sets.
import perfectionist from 'eslint-plugin-perfectionist';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const ORDER_MATTERS = { flags: 'i', pattern: 'order matters' };
// A chart's states, by their shape: an object whose values hold a state's keys (`on`, `entry`, …).
// A chart file's default export is one, and so is any `states`. The first is where it starts.
const STATES =
  'ObjectExpression:has(> Property:has(> ObjectExpression:has(> Property[key.name=/^(after|always|entry|exit|initial|invoke|on|states)$/])))';

// Objects whose order means something keep it; `kept` adds more of them.
const sortObjects = (...kept) => [
  'error',
  ...kept.map((matchesAstSelector) => ({ type: 'unsorted', useConfigurationIf: { matchesAstSelector } })),
  { type: 'unsorted', useConfigurationIf: { declarationCommentMatchesPattern: ORDER_MATTERS } },
  { type: 'unsorted', useConfigurationIf: { matchesAstSelector: STATES } },
  { type: 'natural' },
];

export default defineConfig([
  {
    ignores: [
      'dist/',
      'storybook-static/',
      'framework-stories/',
      '.framework-types/',
      'test-results/',
      'playwright-report/',
      'perf/dist/',
      'perf/out/',
      'public/',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx}'],
    languageOptions: { parser: tseslint.parser, sourceType: 'module' },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { perfectionist },
    rules: {
      ...perfectionist.configs['recommended-natural'].rules,
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index'], 'unknown'],
          internalPattern: ['^framework(/.*)?$', '^@/.+'],
          newlinesBetween: 1,
          newlinesInside: 0,
          type: 'natural',
        },
      ],
      'perfectionist/sort-maps': 'off',
      'perfectionist/sort-modules': 'off',
      'perfectionist/sort-objects': sortObjects(),
      'perfectionist/sort-sets': 'off',
    },
  },
  // A component's keys are listed in the order its shortcuts.ts declares them.
  {
    files: ['**/shortcuts.ts'],
    rules: {
      'perfectionist/sort-objects': sortObjects(
        'ExportDefaultDeclaration > ObjectExpression, ExportDefaultDeclaration > ArrowFunctionExpression > ObjectExpression',
      ),
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  // Two rules of Cape's config, which the framework's code already answers to.
  {
    files: ['**/*.{ts,mts,cts,tsx}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // React's own rules, the ones React Compiler checks among them (`refs`, `immutability`, …), over
  // the runtime and the app. All are errors: what they found when they were turned on is listed in
  // eslint-suppressions.json, a list to burn down (framework/README.md, "The hooks lint").
  {
    files: ['framework/runtime/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: Object.fromEntries(
      Object.keys(reactHooks.configs['recommended-latest'].rules).map((rule) => [rule, 'error']),
    ),
  },
]);
