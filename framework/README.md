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

- A read whose source can change outside the app follows it: `follows` gets a `stale` callback to call whenever the source says so (a flag provider's push, a socket's message), and the read is read again, with every component that read it. The meta file gets the clients too:

  ```ts
  export default ({ clients: { flags } }) => ({
    evaluate: { reads: true, follows: (stale) => flags.changed(stale) },
  })
  ```

### Component folders

A folder under `components/` with a `render` file and no `index` is a component. Importing the folder (`./components/filters`, or `@/components/…`) gives the component, which the plugin writes from the folder's files.

| File | Job |
|---|---|
| `render.tsx` | Places markup and interpolates. Called as a plain function, with no hooks. Receives what `props.ts` returns, or the props with `className`, `async`, `state` and `form`. |
| `props.ts` | A plain function from what the render would get to what it gets: derived values, texts, which actions a person may take. `export type Props` states what a parent passes. |
| `async.ts` | The default export is the read before the first render. Named exports are operations. |
| `state.ts` | The flow, as a statechart. `examples` says what each state needs on screen in the states gallery. |
| `form.ts` | `seed` (server data to values) and `payload` (values to a request). |
| `placeholder.tsx` | Shows while the view loads and reads. Adds a `Suspense`. |
| `error.tsx` | Shows when the view fails. Adds an error boundary around both. |
| `acl.ts` | Whether what the component offers may be done: a function of what `props.ts` gets, the route, and the backend's snapshot with what is inherited, returning a boolean. The component and everything below it get it as `acl.allowed`. |
| `shortcuts.ts` | The keys the component answers while it is on screen: a function of what `props.ts` gets, returning each key with its label and what it does (send a chart's event, focus an element, run a function). |
| `i18n.ts` | The component's messages, in the source language: an object of any shape whose leaves are ICU messages or functions. |
| `i18n/<locale>.json` | A translation of them, keyed by the folder's path and the message's path. Loaded on demand. |
| `style/skins/<name>/index.ts` | The component's CSS for a skin. |

What the framework guarantees about them:

- **The view is lazy.** The render and its layers load together, on demand. Placeholder and error files load eagerly. A view starts loading the views and skins of the components its render imports, so a child does not wait to render before its own code starts loading.
- **A component renders only when what it shows changes.** Every component is wrapped in `React.memo`. When a re-render leaves the props, `async`, `state` and `form` as they were, the framework returns the render's last output instead of calling it, and React skips everything inside. A new answer keeps every part equal to the last answer the component showed, so a child given an unchanged part of it gets the same object. What the render gets (what `props.ts` returns, or the props and layers) is shared the same way with what it got last time: when nothing in it changed, the render is not called, and a part that did not change keeps its identity, so react-aria's collections and memoized children skip it.
- **A component follows only what its files read.** The plugin reads what the first parameter of each function the framework calls destructures (`({ intl, async }) => …`), file by file: each file's default export, and the named exports of `async.ts` (operations) and `state.ts` (checks and changes). A helper a file exports for itself or its tests (`sorting(id)` beside a `props.ts`) is not called with what the framework gives, so it reads nothing. A component re-renders for a change of locale only when one of its files reads `intl`, `locale` or `i18n` (or the folder has an `i18n.ts`), for a change of person only when one reads `user`, for a change of what it may do only when one reads `acl`, and for a change of the keys on screen only when one reads `keyboard`; a parameter that is not destructured reads everything. A default read that reads the locale or the user is keyed by it, so one person never sees another's cached answer.
- **What did not change is what React showed.** When the render is called, its output shares with the last output every element equal to the one at the same place (same type and key, and every prop the same value, or an equal element, list or plain object; keyed items match by key). React skips an element it showed before, and everything inside it. A handler is not a value that changes: the plugin passes every `on…` handler of a render through `track`, which gives it one wrapper per site, key and place among the rows, for the instance's life, calling the handler of the last render React committed. So an element whose only new props are its handlers' closures is the element shown before, and a row's button still calls that row's closure after the rows change order. A function written in the JSX that is not a handler (a list's `{(item) => <ListBoxItem … />}`, a `className={({ isSelected }) => …}`) is moved out of the render by the plugin when it uses nothing of the render: only its own parameters, what the module imports or declares, and globals. It is then one function for the module's life, the element it is given to is equal to the one before, and react-aria does not render the list again because its parent rendered. One that reads something of the render, binds one of its names again, or holds a handler stays where it is written, and is a new function at each render. When the render is called and returns what it returned before, the component returns the element React showed.
- **A component follows only the route fields it reads.** `Root` gives each field of the route a context of its own (React has no selector for a context), so a component renders again for a field it read and for no other. A default read follows the fields its first run read: the list follows `q`, `category`, `sort`, `order` and `page`, and a dialog opening over it does not render it at all. A component with a `state.ts` reads the route being rendered until its first commit, field by field as its chart reads it, and not after. A view whose `props.ts`, render or `acl.ts` reads `route` follows all of it. Fields that appear after `Root`'s first route are read from the whole route. Operations and statecharts read the committed route when they run.
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

### Who is signed in, and what they may do

The app does not own its permissions: the backend sends a snapshot of them, and the framework only carries it. Each consumer tests it against whatever else it knows, and chooses how to react.

- `Root`'s `user` is a read of the services that resolves to the person signed in, or `null` (here the session, then the profile it names). `Root`'s `acl` is another, that resolves to the backend's snapshot (here `/auth/permissions`: a role, grants by resource and action, and limits). Both run through the data layer, so a sign-in or a sign-out reads them again.
- Every component file and chart declaration that reads `acl` gets the snapshot, with `allowed` on it: the decision of the nearest `acl.ts` at or above the component. A folder's `acl.ts` makes that decision for its subtree, as a function of what `props.ts` would get, the route, and `acl` with what it inherits:

  ```ts
  // components/app/acl.ts: everything below inherits it
  export default ({ acl }) => acl.role === 'guest' || acl.grants.products.includes('update')
  // components/product/remove-link/acl.ts: one link, deep in a row, narrower
  export default ({ acl }) => acl.allowed && (acl.role === 'guest' || acl.grants.products.includes('delete'))
  // components/bulk-price/acl.ts: the backend's limit against what the form says
  export default ({ acl, form }) => acl.role === 'guest' || (acl.grants.prices.includes('update') && (acl.limits.priceChange === null || form.values.percent <= acl.limits.priceChange))
  ```

- A render or a `props.ts` branches on it (hide an action, lock a form). A chart's guard reads it when the event arrives. A chart's declaration reads it too, so the chart's shape follows it: a read-only editor has no `save`.

  ```ts
  export default ({ services, acl }) => ({
    editing: { on: { ...(acl.allowed && { save: [ /* … */ ] }), close: [ /* … */ ] } },
  })
  ```

- A chart is also told when a source its file reads changes (`user`, `acl`, `flags`, `locale`), by an event of that name, after the component has rendered with the new value, so a guard reads it. The session's chart reads `user`: on `{ type: 'user' }` it reads the session again when someone signed in in another tab, and leaves when they signed out.
- When a part a declaration read changes, the chart is declared again, and the running flow moves to it at its next rest (no service running, no delay pending): in the same state, with the same context, when the new chart has that state; from the start when it has not. A flow saving when the grant goes sees the save through first.
- A component follows only the parts of the snapshot its files read (`runtime/reads.ts` records them): one that reads `acl.allowed` alone renders again when the decision changes, not when the snapshot does.
- A rule that reads only `acl` is the folder's, the same for every instance: it is decided where the snapshot is read, and an instance renders again only when its decision changes. A sign-in decides the delete link in every row again, and renders none whose answer is the same.
- A chart's guards and the operations read the decision of the render React committed. A render React throws away (a transition the person leaves before its data arrives) decides for itself alone, so a guard never refuses what the page shows as allowed.
- A rule that throws refuses, and is reported as the `acl` layer's failure. A default read that reads `acl` or `user` is keyed by it.
- `framework/testing`'s `startFlow` gives a chart `acl: { allowed: true }` and `user: null` unless the test says otherwise.

**Feature flags.** `Root`'s `flags` is a third read, given the person the `user` read names: `({ services, user }) => services.flags.evaluate({ targetingKey: …, role: … })`. It reads the person the way the `user` read does, so a sign-in or a sign-out reads the flags again, for the new person. A service read that `follows` its provider reads them again when a flag is served another way. `Root` starts its three reads side by side as it mounts, so a flag first needed deep in the tree does not suspend it there.

- Every component file and chart declaration that reads `flags` gets them, waits for them the first time, and follows only the flags it reads: serving one flag another way renders the components that read that flag, and no other.
- A flag is read wherever it decides something. The demo reads one in each of three places, so the choice stays open (S-009, Q-303):
  - in a `props.ts`, for what a component shows: the rows' count is being rolled out (`flags.stockCount`);
  - inside an `acl.ts`, for whether something may be done: deletions paused is not allowed, and everything below follows `acl.allowed`, its keys included, without reading the flag (`flags.deletions && acl.allowed && …`);
  - in a chart's guard, read when the event arrives: the percentage above which the bulk change asks again (`flags.largeChangeAt`).
- A folder rule that reads `acl` and `flags` is still the folder's: one subscription to both reads decides it, and an instance renders again only when its decision changes.
- A default read that reads `flags` is keyed by them.

### Keys

A component folder's `shortcuts.ts` says which keys the component answers while it is on screen. It gets what `props.ts` gets, so a key can follow the locale, what may be done, the chart's state and the component's read:

```ts
// components/catalogue/shortcuts.ts
export default ({ i18n, acl, async: { default: answer } }) => ({
  '/': { label: i18n.keys.search, focus: 'input[type=search]' },
  n: { label: i18n.keys.create, run: () => go({ create: true }), when: acl.allowed },
  ']': { label: i18n.keys.next, run: () => go({ page: answer.page.page + 1 }), when: answer.page.page < answer.page.pages },
})
// components/product/editor/shortcuts.ts
export default ({ i18n }) => ({
  'mod+s': { label: i18n.keys.save, send: 'save' },
})
```

- `send` sends an event of the component's chart, and works only while the chart takes it in the state it is in (`state.can`, guards included). The editor's key does nothing in a read-only editor, whose chart has no `save`, nor while a save runs. The TypeScript plugin types `send` with the chart's events, so `send: 'sav'` is an error.
- `focus` focuses the first element of the component that matches a selector; `run` calls a function; `when`, true when left out, says whether the key may be used now.
- `mod` is ⌘ on Apple devices and Ctrl elsewhere. A symbol (`?`, `/`, `[`) matches with or without shift, as keyboard layouts need.
- One listener on the document. A key reaches a component that can be reached: an element with its class on screen, and nothing hiding it (`inert`, or the `aria-hidden` a modal dialog sets on everything outside it), so the catalogue's keys stop while a dialog is open over it. A key without a modifier is left to the field that has the focus: `/` and `n` type in a search. When two components answer the same key, the one holding the focus wins, then the one shown last. A key some component on screen declares is the app's, even when it does nothing now: `mod+s` never opens the browser's "save page".
- A key that runs is an interaction, tracked like a handler, with its place in `shortcuts.ts` (`components/product/editor#shortcuts.mod+s`).
- A component that reads `keyboard` gets the keys on screen, by component, each with its label, the keys as the platform writes them (`⌘ S`, `Ctrl S`) and whether it does something now. The app's `?` list reads it, and is a component of its own, shown only while open, so nothing renders again when the keys change while it is closed.

### The data layer

Every service operation goes through it.

- A read is cached under the service's path, the selected entity and its arguments (`['products.search', 'shop', { category: 'audio' }]`). Calls in flight are shared. `freshFor` serves an answer again for a while without asking.
- A component's `async.ts` default export runs as a query of its own. The framework records the reads it calls and the route fields it reads. Its key holds the component's path, the entity, and those fields, so another category is another query, and a dialog's `edit` does not touch the list.
- A write that makes one of those reads stale reruns the queries on screen that used it, and drops the off-screen ones, so a revisit reads anew.
- `Root` takes a `client` made with `createQueryClient()`. An app that keeps one for its life keeps a page's reads cached across navigations.

**Optimistic writes.** A write's rule may say how it changes the answers of some reads, by reference, before the server confirms it:

```ts
import { update } from 'framework'

export default ({ services: { products } }) => ({
  setStock: {
    invalidates: [products.search, products.get],
    optimistic: [
      update(products.search, (page, { id, stock }) => changed(page, id, { stock })),
      update(products.get, (product, { id, stock }) => (product.id === id ? edited(product, { stock }) : product)),
    ],
  },
})
```

- `update` types each change by its read (`page` is a `Page`) and by the write (`{ id, stock }` is what `setStock` takes): a mistyped field is an error.
- When the write is sent, every cached answer of those reads shows the change, and every component whose default read used one is worked out again from the cache, without asking the server. A count in a row moves the moment it is pressed.
- The writes sent and not settled are kept in order over the server's last answer, a rebase: an answer that lands meanwhile gets them laid over it again, and a write that fails is taken out while the others stay. Three presses where the first is refused still show the third's count, which is where the server ends.
- A write that succeeds makes the reads it changed stale too, so the server has the last word. A change that predicts the server's answer exactly (the version it will bump) renders nothing when that answer arrives.

**Reads that follow their source.** A read with `follows` in its `meta.ts` is made stale when its source says so, not by a write: the flags' reads follow the provider, so a flag served another way, in this tab or in another one that told its own provider, reads the flags again. The inspector shows it as the read's source changing.

A read whose source is the browser's storage follows the `storage` event too. The demo's session and its overlay of local changes live in localStorage, which the tabs share. Another tab's message on the channel can arrive before its write can be read here, since WebKit makes another page's writes visible in its own time. The event fires only once it can. So the session's reads and the products' reads follow it (`clients/storage.ts`'s `shared()` and `watch`).

`window.__framework.fromTab()` resolves once the data layer has handled the next message from another tab, for tests that drive two tabs: a channel of the test's own hears the message in its own time, not the app's.

**Other tabs.** `Root`'s `sync` names a channel the app's tabs share (`BroadcastChannel`). A write that succeeds in one tab tells the others which reads it made stale, by path, and they read them again: a save, a count, a sign-in or a sign-out in one tab reaches the others, and with them who is signed in, the snapshot of what they may do, and every component that read any of it. Only confirmed writes cross; optimistic changes stay in their tab. Work that one tab must do for all, such as refreshing a session they share, is the client's: the demo's takes a Web Lock (`clients/dummyjson/http.ts`).

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
- The render gets `state`: one boolean per state (`state.saving`), the `context`, `send`, which takes only the chart's events, and `can`, whether the chart takes an event in the state it is in, guards included.
- A component renders again when its chart shows something else: other states, another context, or the chart coming to rest. A chart also moves with none of that changing (a state entered again, a service started or done), and that renders nothing. A change that returns what the context already holds leaves the context as it is, and a part it returns equal to the one held keeps its identity, as a read's answer does: a panel that reads a list every second and finds it as it was renders nothing.

`framework/testing` runs a `state.ts` without React:

```ts
const form = formOf(editorForm)
const flow = startFlow(editor, { services: { products: { get, save } }, form, route, navigation })
flow.send({ type: 'save' })
await flow.settled()
expect(flow.states).toEqual(['saved'])
```

### The states gallery

Every component folder with a `state.ts`, in each state of its chart, from the folders alone:

- The plugin lists the folders with a chart (`virtual:framework/charts`). `charts()` declares each chart with a stand-in for the injection that answers anything, so a declaration that branches on what may be done lists every state it can have, and gives each state's path and `description`.
- `<Pinned path state example>` holds the component at `path`, rendered inside, in one state: its chart is created in that state and never started, so no service runs and no event moves it. `chartAt(path)` loads the component and its examples.
- A state that needs more on screen than the chart starts with gets it from the `state.ts`'s `examples`, by state: `context` over the chart's own, `values` over the form's empty ones, and `props` a parent would pass.

  ```ts
  export const examples = {
    conflict: { context: { title: 'Arc Floor Lamp' }, values: { ...lamp, price: 249.99 } },
    failed: { context: { title: 'Arc Floor Lamp', error: 'The server answered 500.' }, values: lamp },
  }
  ```

The demo's page is `#/states`: one frame per state, each the app alone in the memory world, in the locale on screen, at half its size. A frame per state keeps each one's dialogs to itself. A state's description is its chart's, as `state.ts` writes it.

### The form stand-in

A component's `form.ts` says how server data becomes the form's values (`seed`) and how the values become a request (`payload`). The render gets `form.values`, `form.initial` and `form.set`; the state layer gets `form.unsaved`, `form.payload()` and `form.seed(…)`. `set` and `seed` stay the same functions for the component's life. A real form manager would replace it.

- The values live outside React, in a store per instance, and a component follows only the values its files read, as it follows the flags. A field that shows a value it reads (`value={form.values.title}`) renders the component as a key is pressed, which is what the sign-in dialog does when a button fills a demo account in.
- A field that holds what is typed, given `form.initial` as its starting value (`defaultValue={form.initial.title}`), renders alone, as a native form field does: the editor's six keys render no framework component, and about eight of react-aria's pieces each (the field, its label, its input, its error). The editor reads the values only to say what is wrong with them, once a save was tried.
- A seed renders the components that read `initial`; a field mounted again after it starts from it. The chart's guards and the operations read the latest values when they run, and follow none.

### The async layer

- Each named export of `async.ts` reaches the render as `async.<name>`: a function that runs it, carrying `pending`, `error` and `data`.
- An export takes the injection (plus a `signal`) and returns a promise, or returns a function of the call's arguments.
- The default export runs before the component mounts, while the placeholder shows, as a query of the data layer. Its result reaches the render as `async.default`.
- Unmounting stops state changes and aborts the operations' signals.

### The pipelines

One `EventTarget` carries three kinds of event.

- **Interactions.** The Vite plugin wraps every JSX `on…` handler of a render, placeholder or error file in `track(handler, site, key)`, and every key a `shortcuts.ts` declares runs the same way, with its place in that file. Each interaction carries:
  - its build-time placement: path, file, line, element, prop;
  - its run-time chain of parent components;
  - its cause, when another handler called it;
  - the DOM event's type, and never values.

  `data-track="off"` opts an element out. Destinations plug in with `connect({ name, purpose, accept, map, send, batch })` and wait for consent.
- **Failures.** Each layer reports what it catches, once, tagged with layer, path and what was running: services and component queries, async operations, handlers, charts, `props.ts`, `acl.ts`, `shortcuts.ts`, render errors, and the window's `error` and `unhandledrejection` as unidentified. `onFailure(listener)` listens to all of them.
- **Data.** What the data layer does: each read the server answers, with how long it took; each component's default read, with the reads it called; each write, sent and ended, with the interaction whose handler sent it; each optimistic change shown and each one taken back; each component answer worked out again from the cache; the reads each write made stale; each message to and from the other tabs. `onData(listener)` listens to them. The demo's network lab shows them, with the interactions and failures, as an inspector.

### Skins

- `style/skins/<name>/index.ts` default-exports plain CSS through `css` (`String.raw`). The runtime nests it under the component's escaped class, in one `<style>`, the first time the component renders with that skin. Each skin is its own lazy chunk.
- `Root`'s `skin` picks the page's skin; the other skins' sheets stop applying.
- In `style/` files, the default import of another component folder becomes its escaped selector, so `${Lab} { … }` targets it.
- Content a component renders in a portal (a dialog) takes the component's class, so the skin reaches it.

### Types of injected arguments

Nobody writes them. The TypeScript plugin shows TypeScript each layer file with its first parameters annotated:

| File | Functions annotated | With |
|---|---|---|
| `render` | the default export | what `props.ts` returns, or the props with `className`, `async`, `state`, `form`, `i18n`, `intl`, `locale`, `user`, `acl`, `route`, `flags`, `keyboard` |
| `shortcuts` | the default export, and what it returns | what `props.ts` gets; keys whose `send` takes the chart's events |
| `props`, `acl` | the default export | the file's own `Props`, with `className`, `async`, `state`, `form`, `i18n`, `intl`, `locale`, `user`, `acl`, `route`, `flags` |
| `async` | the default and every named export | the injection, the route, a `signal` |
| `state` | the default export; every exported function | the injection with `acl`, `user`, `flags` and the locale; `context`, `event`, the route, the form… |
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
- **The data layer:** services get no `signal`. Component queries stay fresh until a read they used is made stale, or their key changes; changes made by someone else are not seen until then, unless the read follows its source.
- **Flags:** a component follows every flag it has ever read, not only those its last render read: a row that read `acl.role` while counting was on still renders when the role changes with counting off, to the same output.
- **The pipelines:** a failure is reported once, by the first layer that catches it, so outer layers' context (the handler's site, say) is not added to a service's failure.
- **Skins:** a skin overridden for a subtree; removing CSS with the last instance.
- **A service export that is not an operation** (a constant, say) fails when the app starts, not at build time.
