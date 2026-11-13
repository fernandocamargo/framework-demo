# The framework

A small React framework in which a component is a folder, each file of the folder has one job, and everything a file needs is injected and typed. It has four parts:

- `plugin/index.mjs`: the Vite plugin. It wires the folders and rewrites code. Plain JavaScript, so `plugin/write-types.mjs` can run it without Vite.
- `runtime/`: what the generated modules call, imported as `framework`. `runtime/types.ts` holds the types of what it injects.
- `typescript/`: the TypeScript language-service plugin that types those injected arguments, and `check.cjs`, the same thing for the command line.
- `shared/folders.cjs`: the folder rules both plugins follow, and the convention checks.

It is built on React 19, TanStack Query 5 (the data layer) and XState 5 (the state layer). Neither shows in an app's code: an app writes plain functions and plain objects in fixed places.

## What it does

The plugin reads one root folder (here `src`), which holds `clients/`, `services/` and `components/`.

### Clients

`clients/<folder>/index.ts` default-exports `({ env }) => client`. Services see it as `clients.<folder in camel case>`, unless a `meta.ts` beside it returns `{ exportAs }`. Each client is created on first use.

### Services

- Every folder under `services/` with an `index` is a service, at any depth.
- A default export is `services.a.b(…)`; named exports are `services.products.search(…)`.
- Each export receives the injection (`env`, `entity`, `clients`, `services`, `url`) once, on first use, and returns the operation.
- A service folder's `meta.ts` names its reads and, by reference, what each write makes stale:

  ```ts
  export default ({ services: { products } }) => ({
    search: { reads: true },
    categories: { reads: true, freshFor: 5 * 60_000 },
    save: { invalidates: [products.search, products.get] },
  })
  ```

### Component folders

A folder under `components/` with a `render` file and no `index` is a component. Importing the folder (`./components/filters`, or `@/components/…`) gives the component, which the plugin writes from the folder's files.

| File | Job |
|---|---|
| `render.tsx` | Places markup and interpolates. Called as a plain function, with no hooks. Receives what `props.ts` returns, or the props with `className`, `async`, `state` and `form`. |
| `props.ts` | A plain function from what the render would get to what it gets: derived values, texts, which actions a person may take. `export type Props` states what a parent passes. |
| `async.ts` | The default export is the read before the first render. Named exports are operations. |
| `state.ts` | The flow, as a statechart. |
| `form.ts` | `seed` (server data to values) and `payload` (values to a request). |
| `placeholder.tsx` | Shows while the view loads and reads. Adds a `Suspense`. |
| `error.tsx` | Shows when the view fails. Adds an error boundary around both. |
| `i18n.ts` | The component's messages, in the source language: an object of any shape whose leaves are ICU messages or functions. |
| `i18n/<locale>.json` | A translation of them, keyed by the folder's path and the message's path. Loaded on demand. |
| `style/skins/<name>/index.ts` | The component's CSS for a skin. |

What the framework guarantees about them:

- **The view is lazy.** The render and its layers load together, on demand. Placeholder and error files load eagerly. A view starts loading the views and skins of the components its render imports, so a child does not wait to render before its own code starts loading.
- **A component renders only when what it shows changes.** Every component is wrapped in `React.memo`. When a re-render leaves the props, `async`, `state` and `form` as they were, the framework returns the render's last output instead of calling it, and React skips everything inside. A new answer keeps every part equal to the last answer the component showed, so a child given an unchanged part of it gets the same object. What the render gets (what `props.ts` returns, or the props and layers) is shared the same way with what it got last time: when nothing in it changed, the render is not called, and a part that did not change keeps its identity, so react-aria's collections and memoized children skip it.
- **A component follows only what its files read.** The plugin reads what the first parameter of each function the framework calls destructures (`({ intl, async }) => …`), file by file. A component re-renders for a change of locale only when one of its files reads `intl`, `locale` or `i18n` (or the folder has an `i18n.ts`); a parameter that is not destructured reads everything. A default read that reads the locale is keyed by it.
- **Only components that read the route follow the route.** A component with a default read reads the route context, and so does one with a `state.ts` (its chart may read the route when it is created). Other components do not re-render when the address changes. Operations and statecharts read the committed route when they run.
- **What a parent passes is checked** when the child's `props.ts` exports a type named `Props`: the plugin writes the folder's declaration from it. A folder without one takes any props.

### The i18n layer

A component folder's `i18n.ts` holds its messages in the source language (English here), as an object of any shape: namespaces as deep as the author likes, recurring names such as `title` under each.

```ts
export default {
  title: 'Products',
  summary: '{count, plural, one {# product} other {# products}}{filter, select, q { matching “{q}”} other {}}',
  empty: { title: 'Nothing matches', actions: { clear: 'Clear the filters' } },
}
```

- The component gets `i18n`, the same shape. A message with no arguments is a string. One with arguments or tags is a function of their values, typed from the ICU: `i18n.summary({ count, filter, q })` takes `{ count: number; filter: string; q: string | number }`, and a missing value is a type error. A tag (`<b>…</b>`) takes a function that says what it becomes, and gives React nodes. A function leaf `(values, intl) => …` is called with its values.
- `intl` is react-intl's, for the locale on screen: `formatNumber`, `formatDate`, `formatList`, `formatRelativeTime`. `locale` is the locale itself.
- Translations live beside the messages, in `i18n/<locale>.json`, as flat objects keyed by path (`"components/catalogue/empty/title": "Nada encontrado"`), the shape translation tools exchange. Each loads on demand, the first time a component of the folder shows in that locale. A region falls back to its language's file (`pt-PT` reads `pt.json`), and a locale with none shows the source.
- `Root`'s `locale` says which locale shows. When it changes, the page keeps the old locale on screen until every component on it has its messages in the new one, then shows the new one in one commit; nothing suspends. A component that reads none of `i18n`, `intl` and `locale` does not render again.
- The messages of a folder in a locale are built once and shared by every instance.
- The TypeScript plugin reads `i18n.ts` `as const`, so each message's type is its own text, and `runtime/i18n-types.ts` reads the ICU in it. The checks read every translation against `i18n.ts`: see "Mistakes it names".
- `framework/testing`'s `messagesOf(module, locale?, translations?)` builds a folder's `i18n` for a test of its `props.ts`, and `intlOf(locale)` gives `intl`.

### The data layer

Every service operation goes through it.

- A read is cached under the service's path, the selected entity and its arguments (`['products.search', 'shop', { category: 'audio' }]`). Calls in flight are shared. `freshFor` serves an answer again for a while without asking.
- A component's `async.ts` default export runs as a query of its own. The framework records the reads it calls and the route fields it reads. Its key holds the component's path, the entity, and those fields, so another category is another query, and a dialog's `edit` does not touch the list.
- A write that makes one of those reads stale reruns the queries on screen that used it, and drops the off-screen ones, so a revisit reads anew.
- `Root` takes a `client` made with `createQueryClient()`. An app that keeps one for its life keeps a page's reads cached across navigations.

### The idle signal

`whenIdle()`, also `window.__framework.idle()`, resolves once nothing is pending for two frames in a row and then in the browser's next idle period: no read or write in a `Root`'s client, no view or skin loading, no operation running, no placeholder on screen, and no route `Root` has rendered but React has not committed.

Tests wait on it instead of sleeping or polling selectors. It does not see timers, requests made outside the framework, or an overlay still closing. It ships in every build, production included, so end-to-end tests run against the build people use: it costs a counter, an effect per placeholder on screen and a ref per `Root`, and it only returns a promise, with no data and no way to change the page.

### The state layer

`state.ts` holds the flow as a statechart:

- `export default ({ services }) => ({ …states })`. The first key is where the component starts, at every level.
- Operations are referenced, not named by strings: `invoke: { src: services.products.save, input: changesToSave, onDone, onError }`.
- Checks, changes and inputs are the file's exported functions, referenced where they apply (`guard: unsaved`). They receive XState's `context`, `event` and `self`, plus `route`, `flags`, `form`, `navigation`, `entity` and `services`. A change that returns an object updates the context.
- `export const context` returns what the flow remembers. `export type Events` gives the payloads of events that carry one.
- `after: { 1000: … }` is XState's delayed transition, with the same references.
- The render gets `state`: one boolean per state (`state.saving`), the `context`, and `send`, which takes only the chart's events.

`framework/testing` runs a `state.ts` without React:

```ts
const form = formOf(editorForm)
const flow = startFlow(editor, { services: { products: { get, save } }, form, route, navigation })
flow.send({ type: 'save' })
await flow.settled()
expect(flow.states).toEqual(['saved'])
```

### The form stand-in

A component's `form.ts` says how server data becomes the form's values (`seed`) and how the values become a request (`payload`). The render gets `form.values` and `form.set`; the state layer gets `form.unsaved`, `form.payload()` and `form.seed(…)`. `set` and `seed` stay the same functions for the component's life. A real form manager would replace it.

### The async layer

- Each named export of `async.ts` reaches the render as `async.<name>`: a function that runs it, carrying `pending`, `error` and `data`.
- An export takes the injection (plus a `signal`) and returns a promise, or returns a function of the call's arguments.
- The default export runs before the component mounts, while the placeholder shows, as a query of the data layer. Its result reaches the render as `async.default`.
- Unmounting stops state changes and aborts the operations' signals.

### The pipelines

One `EventTarget` carries two kinds of event.

- **Interactions.** The Vite plugin wraps every JSX `on…` handler of a render, placeholder or error file in `track(handler, site, key)`. Each interaction carries:
  - its build-time placement: path, file, line, element, prop;
  - its run-time chain of parent components;
  - its cause, when another handler called it;
  - the DOM event's type, and never values.

  `data-track="off"` opts an element out. Destinations plug in with `connect({ name, purpose, accept, map, send, batch })` and wait for consent.
- **Failures.** Each layer reports what it catches, once, tagged with layer, path and what was running: services and component queries, async operations, handlers, charts, `props.ts`, render errors, and the window's `error` and `unhandledrejection` as unidentified. `onFailure(listener)` listens to all of them.

### Skins

- `style/skins/<name>/index.ts` default-exports plain CSS through `css` (`String.raw`). The runtime nests it under the component's escaped class, in one `<style>`, the first time the component renders with that skin. Each skin is its own lazy chunk.
- `Root`'s `skin` picks the page's skin; the other skins' sheets stop applying.
- In `style/` files, the default import of another component folder becomes its escaped selector, so `${Lab} { … }` targets it.
- Content a component renders in a portal (a dialog) takes the component's class, so the skin reaches it.

### Types of injected arguments

Nobody writes them. The TypeScript plugin shows TypeScript each layer file with its first parameters annotated:

| File | Functions annotated | With |
|---|---|---|
| `render` | the default export | what `props.ts` returns, or the props with `className`, `async`, `state`, `form`, `i18n`, `intl`, `locale` |
| `props` | the default export | the file's own `Props`, with `className`, `async`, `state`, `form`, `i18n`, `intl`, `locale` |
| `async` | the default and every named export | the injection, the route, a `signal` |
| `state` | the default export; every exported function | the injection; `context`, `event`, the route, the form… |
| `placeholder`, `error` | the default export | the props, and `i18n`, `intl` and `locale` when the folder has an `i18n.ts`; the `error` and `resetErrorBoundary` |
| `i18n` | its default export is read `as const` | each message's own text, which `I18n<…>` reads as ICU |
| `services/**/index` | every export | the injection |
| `services/**/meta` | the default export, and what it returns | the injection; the service's own operations |
| `clients/*/index` | the default export | `env` |

The services and clients in those types are the app's, read from the folders. Hovers show what things are, not how the types were computed: `fetchSave: Operation<Saved>`, `services: { products: { search: (query: Query) => Promise<Page>; … } }`. An app declares its `Env`, `Entity`, `Route`, `Flags` and `Navigation` by augmenting the runtime's interfaces (`src/env.d.ts`). In editors, positions are mapped back to the file as written.

The Vite plugin writes one declaration per component folder into `.framework-types/` (git-ignored). `rootDirs` and `paths` in `tsconfig.json` merge them with the sources, so `./components/filters` and `@/components/…` resolve.

## Mistakes it names

Every convention mistake that would otherwise fail silently, or far from its cause, is named by file and rule (`shared/folders.cjs`, `problems`). The dev server and the build show them as warnings, and `npm run typecheck` fails on them:

- a layer file in the wrong case (`State.ts`: "rename to state.ts");
- a folder with `async`, `state` or other layers but no `render`, which is then not a component;
- a folder with both `render` and `index`, whose render is then not used;
- a service `meta.ts` with no `index` beside it, and a client folder with no `index`;
- JSX outside a component folder's `render.tsx`, `placeholder.tsx` or `error.tsx` under `components/`, `services/` or `clients/`, where the plugin would not track its handlers;
- a second component in one of those files: JSX outside its default export, or an element whose tag is a component declared in the file.
- an `i18n.ts` whose default export is not an object literal of strings, functions and objects of them, so its messages cannot be read without running it, and a message that is not valid ICU;
- a translation that misses a message, names one `i18n.ts` does not have, translates a function, or loses or adds an argument or a tag (`"components/catalogue/paging/page" loses {pages}`), and translations in a folder with no `i18n.ts`.

A service `meta.ts` is also typed by what it returns, so a mistyped operation name reports "Did you mean to write 'search'?" instead of leaving a read uncached. Skins are read with the same parser as renders, so `import X, { y }` from a component is an error that says why, not a function inside CSS.

## Editors

The plugin loads in any editor that runs TypeScript through tsserver, once tsserver can find it. tsserver loads a tsconfig's plugins only from its own install, or from the "plugin probe locations" it is given. In VS Code that leaves two ways:

- **The project's TypeScript.** Run "TypeScript: Select TypeScript Version" and choose "Use Workspace Version". The plugin then loads from the project's `node_modules`, where `npm install` links it (`framework-typescript-plugin`).
- **VS Code's own TypeScript, with a user setting.** Add the project's folder to `typescript.tsserver.pluginPaths` in the user settings. The setting is machine-scoped, so a workspace cannot set it.

Either way, plain `tsc -p .` does not load plugins, and reports the injected arguments as implicit `any`. That is why `npm run typecheck` runs `typescript/check.cjs`.

After a change to the plugin's own files (`framework/typescript/`), run "TypeScript: Restart TS Server": tsserver loads a plugin once.

## Tests

- `runtime/__tests__/`: the idle signal, the async layer, components (what re-renders and what does not), the data layer, the pipelines. `npx vitest run framework`.
- `shared/folders.test.cjs` and `typescript/transform.test.cjs`: the convention checks, and the annotations the TypeScript plugin inserts. `node --test`.

## Not in it, or open

- **Typing:** ESLint and Vitest do not load the TypeScript plugin, so a test file gets the injected types only through `check.cjs`. The language-service requests the plugin does not map (outlines, formatting, refactors) see the file as written.
- **Routing:** `Root` takes a `route` object and a `navigation` object from the app. A routing layer would own both.
- **Forms:** `form.ts` is a stand-in for a form manager.
- **The data layer:** services get no `signal`. Component queries stay fresh until a read they used is made stale, or their key changes; changes made by someone else are not seen until then.
- **The pipelines:** a failure is reported once, by the first layer that catches it, so outer layers' context (the handler's site, say) is not added to a service's failure.
- **Skins:** a skin overridden for a subtree; removing CSS with the last instance.
- **A service export that is not an operation** (a constant, say) fails when the app starts, not at build time.
