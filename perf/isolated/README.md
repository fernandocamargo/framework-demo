# Isolated catalogue filters

Run from the worktree root, with the repository's installed dependencies:

```sh
export PATH=~/.nvm/versions/node/v24.21.0/bin:$PATH
export CHROMIUM=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-1243/*/chrome-headless-shell)
export WEBKIT=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh
PORT=5197 node perf/isolated/run.mjs
```

The driver builds production React with `react-dom/profiling`, without minification, using its own Vite config. It starts a localhost preview on `PORT` (5197 by default), runs Chromium and WebKit, and closes its own server and browsers. It does not use the application's Playwright config or port 5181. Browser requests outside that local origin are blocked. No dependency installation is needed.

It prints one table per engine, then names the top six groups in the three largest cells with no change, including their recorded prop, hook and context causes. Complete commits, all groups and the five checked states per variant go to `perf/isolated/out/<engine>.json`; the printed report also goes to `<engine>.txt`. The production build goes to `perf/isolated/node_modules/.vite/dist`, where compiled dependencies are excluded from source linting. These outputs and the build are ignored by Git; the nested cache installs no packages.

For a manual visit:

```sh
npx vite build --config perf/isolated/vite.config.ts
npx vite preview --config perf/isolated/vite.config.ts --port 5197 --strictPort
```

Open `http://localhost:5197/?variant=aria-docs`, `?variant=aria-framework` or `?variant=native`.

## What is compared

All variants have the same English messages, 20 categories plus “All categories”, five sorts, a search value held separately from the submitted query, two pagination links and 12 plain rows. Typing changes the field; submitting, sorting, choosing a category and paging change the values the rows read. There is no Strict Mode, router, data client, framework plugin, runtime import, network read, skin or animation.

- `aria-docs` uses the controlled React Aria composition from the catalogue: SearchField/Input/Button and Select/Button/SelectValue/Popover/ListBox/ListBoxItem. The items and item renderers are module constants; callbacks and their containing object keep their identity through `useCallback` and `useMemo` with their actual dependencies. Values live in ordinary `useState`. JSX is constructed on each React render, as in an ordinary controlled example.
- `aria-framework` uses those same controls and values. It models the identities that reach them today, rather than assuming every allocation in `props.ts` reaches React. That file prepends the translated “all” category and maps the translated sorts. `useShow` in `framework/runtime/component.tsx` applies `shareByIdentity` to this output, so equal arrays and their members keep their identity. `handlersModule` in `framework/plugin/index.mjs` memoizes each handler by the form or navigation methods it reads and memoizes the handlers object; its JSX transform hoists the item renderers. `className` is the same path string, and messages keep their identity while the locale stays the same. Finally, `shareElements` reuses unchanged JSX subtrees, including the entire filter element on a page change. Here ordinary memos with the corresponding dependencies reproduce those results. No framework code is imported or copied.
- `native` uses a controlled search input and two controlled selects with the same options and commands. Pagination uses native anchors in all three variants because the current catalogue does too. Their local click handler changes plain React state without reloading the document.

The distinction between the two React Aria variants is thus element reuse, not deliberately unstable option arrays or callbacks. Static descendants inside a changed control are reused too. If the owner wants a separate experiment with intentionally fresh arrays, that would answer a different question from how the framework feeds these controls today.

## What is counted

`run.mjs` loads `../recorder.js` unchanged as an init script before React. A table cell counts every component the recorder sees in commits for that interaction, including mounts. The number in parentheses counts only re-renders that changed nothing in their own DOM subtree, using the existing attribute, text, insertion/removal and native control property checks. Mounts are recorded separately in the details. These are committed renders, not executions React discards; the existing recorder has no all-library execution counter.

Each variant starts in a fresh browser context. Initial mounting is excluded. Each then types `lamp` key by key and presses Enter, selects “Price, high to low”, selects “Lighting”, follows Next and follows Previous. Opening, selecting, closing and focus work all belong to the corresponding interaction. With no framework idle signal, the driver waits for three consecutive animation frames with no new commit and no pending/running animation. It checks every row's query, sort, category and page, the search value, the selected control when choosing and absence of an open listbox. There are no timed sleeps. Late work beyond that settling boundary remains a limitation of this small harness.

Expect the native version to have fewer component renders and React Aria still to have some renders with no DOM change, for example while distributing focus, selection and collection state. The framework's element reuse may reduce those counts relative to ordinary JSX reconstruction. The measurements must decide how much. A no-change render alone does not establish a defect, and these five isolated steps cannot be equated with the full visit's roughly 2,058 no-change renders. Compare the largest named groups and causes before deciding what to investigate next.

## Checks

```sh
npx tsc -p perf/isolated/tsconfig.json
node --test perf/isolated/report.test.mjs
npm run check
```

The report tests check mount versus re-render accounting, phase boundaries, cause grouping and the complete interaction-by-variant table. The browser driver asserts that the recorder is connected and that profiling durations are present before accepting a run.
