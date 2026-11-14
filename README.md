# Stockroom: requirements held by code

A small back office (a product catalogue over [DummyJSON](https://dummyjson.com)) built on a small React framework. The app is the example. The framework is the point: it is an attempt to make the mechanical part of building software checkable, so that people and agents who hand work to each other have something firmer than prose to agree on.

It runs at https://fernandocamargo.github.io/framework-demo/. An explainer of the idea, written for a team, is at [explainer/](https://fernandocamargo.github.io/framework-demo/explainer/) (its source is [`public/explainer/index.html`](public/explainer/index.html)).

It is meant to be read in an evening or two. The framework is about 5,700 lines in [`framework/`](framework/README.md); the app is about 6,000 in [`src/`](src), a third of it CSS, fixtures and translations.

## The idea

A requirement usually lives in a ticket, and an acceptance criterion in a sentence. Whoever implements it, a person or an agent, turns the sentence into code spread over a component: some state, an effect, a handler, a fetch. A reviewer then has to find the rule again in that code.

Here, the rule has a place before it is written.

- **Small contracts.** A component is a folder, and each file in it has one job. The flow of a dialog is a statechart in `state.ts`. The checks and changes of that flow are exported pure functions. What the markup shows is worked out by a pure function in `props.ts`. What is read and written is said in `async.ts` and in services. Each file's shape is fixed, so "where does this rule go?" has one answer.
- **Handshakes.** The files meet at typed seams. A render can only send the events its statechart has. A parent can only pass the props the child's `props.ts` declares. A write names, by reference, the reads it makes stale. An implementer who breaks a handshake hears about it from the type check, not from a reviewer.
- **Deterministic checks.** A Vite plugin wires the folders. A TypeScript language-service plugin types everything the framework injects, so nobody writes those types and nobody gets them wrong. Convention checks name the mistakes that would otherwise fail silently: a second component in a file, JSX outside a render, a layer file in the wrong case. They run in the editor, in the build and in `npm run typecheck`.
- **Tests at the seams.** An acceptance criterion becomes a test of a pure function: a guard, an action, a `props.ts`, a service against a fake client. No rendering, no mocks of modules, no network.
- **Review of the rule.** Because wiring is the framework's job, the diff of a behaviour change is the flow and a rule. Commit [`8dbdf91`](https://github.com/fernandocamargo/framework-demo/commit/8dbdf91) shows one (see [Review](#review)).

What this does not do: it does not decide what to build, and it does not judge whether a flow is the right one. Strategy and judgement stay with people. The framework moves the mechanical part (wiring, tracking, cache invalidation, typing, conventions) into checks, so that attention goes to the part that needs it.

## The framework's words

| Word | Meaning |
|---|---|
| Component folder | The module. A folder under `components/` with a `render.tsx`. Importing the folder gives the component. Its path (`components/product/editor`) is its identity and its CSS class. |
| Layer file | A file with a fixed name and job inside a component folder: `render.tsx`, `props.ts`, `async.ts`, `state.ts`, `form.ts`, `i18n.ts`, `acl.ts`, `shortcuts.ts`, `placeholder.tsx`, `error.tsx`. |
| `shortcuts.ts` | The keys a component answers while it is on screen, translated, each sending a chart's event, focusing an element or running a function, and working only while the chart takes the event or its `when` holds. `?` lists them. |
| `acl.ts` | Whether what a component offers may be done, as a boolean. The component and everything below it get `acl.allowed`, until a folder below says otherwise. |
| Flags | What the person signed in gets of each feature flag, as `flags`, through OpenFeature. Any file may read them; a component follows only the flags it reads. |
| `props.ts` | The module's interface. `export type Props` says what a parent passes; the default export shapes what the render gets. |
| Client | A transport: how the app reaches a system. A folder under `clients/`. |
| Service | The operations on one resource, written against clients. A folder under `services/`. |
| Injection | What the framework hands to a layer file's functions: `clients`, `services`, `route`, `navigation`, `form`, `i18n`, `intl`, `locale`. Components never import a client or a service. A component follows only what its files read: one that does not read the locale never renders for a change of it. |
| Messages | A component's words, in its `i18n.ts`, as an object of any shape; translations beside it in `i18n/<locale>.json`, loaded when a component of the folder first shows in that locale. |
| Skin | A component's plain CSS, nested under its class: `style/skins/<name>/index.ts`. |

## One component, toured

The product editor, [`src/components/product/editor/`](src/components/product/editor):

```
editor/
  render.tsx    Places markup and interpolates. No logic, no hooks.
  props.ts      A pure function: what the render gets, in each state of the flow.
  state.ts      The flow, as a statechart. Its checks and changes are exported pure functions.
  form.ts       Server data to fields (seed), fields to a request (payload), and what is wrong with them.
  async.ts      What to read before the first render: the categories.
  i18n.ts       Its words, in English, namespaced as the dialog is: heading, fields, problems, conflict…
  i18n/pt-BR.json  The same words in Brazilian Portuguese, checked against i18n.ts key by key.
  shortcuts.ts  Its key: mod+s sends `save`, and does nothing while the chart takes no `save`.
  state.test.ts The editor's rules, tested without React.
  style/skins/default/index.ts   Plain CSS.
```

The flow reads as the requirement does ([`state.ts`](src/components/product/editor/state.ts), shortened):

```ts
export const unsaved = ({ form }) => form.unsaved
export const isConflict = ({ event }) => event.error instanceof Error && event.error.name === 'ConflictError'
export const changesToSave = ({ form, context, route }) => ({ id: route.edit ?? 0, changes: form.payload(), version: context.version })

export default ({ services }) => ({
  editing: {
    on: {
      save: [{ guard: invalid, actions: showProblems }, { guard: creating, target: 'creating' }, { target: 'saving' }],
      close: [{ guard: unsaved, target: 'confirmingDiscard' }, { actions: close }],
    },
  },
  confirmingDiscard: {
    description: 'There are unsaved changes. The person discards them or goes back to them.',
    on: { discard: { actions: close }, keepEditing: 'editing' },
  },
  saving: {
    invoke: {
      src: services.products.save,
      input: changesToSave,
      onDone: 'saved',
      onError: [{ guard: isConflict, target: 'conflict' }, { target: 'failed', actions: rememberError }],
    },
  },
  // …
})
```

There are no type annotations in that file, and none are missing. The TypeScript plugin types `form`, `context`, `route`, `event` and `services` from the folder's other files and from the app's clients and services. The render receives `state` with one boolean per state and a `send` that accepts only this chart's events.

The same folder shape holds a wizard ([`bulk-price/`](src/components/bulk-price)), a session with token refresh ([`session/`](src/components/session)), and a list row with no flow at all ([`product-row/`](src/components/catalogue/components/product-row)).

## Rules in different places

The app does not own its permissions. A backend sends a snapshot of them (a role, grants by resource and action, limits), and the framework carries it to every file that reads `acl`, with `allowed` on it: the decision of the nearest `acl.ts` above. DummyJSON has no permissions endpoint, so the API client answers `/auth/permissions` from the user's role, as a backend would ([`clients/permissions.ts`](src/clients/permissions.ts)). The sign-in dialog offers one account per role (Emily, admin; Olivia, moderator; Avery, user).

Each consumer tests the snapshot against what else it knows:

| Where | Test |
|---|---|
| [`app/acl.ts`](src/components/app/acl.ts) | Changing the catalogue needs the grant to update products. Every component below inherits the decision: the catalogue hides its actions, a row its edit link, the editor locks its fields. |
| [`product/remove-link/acl.ts`](src/components/product/remove-link/acl.ts) | One link, inside every row and the product dialog, narrower: it needs the grant to delete. |
| [`product/remove/acl.ts`](src/components/product/remove/acl.ts) | The same for the dialog, which an address (`?remove=4`) can open for anyone. |
| [`bulk-price/acl.ts`](src/components/bulk-price/acl.ts) | The backend's limit on a price change, against the percentage in the form: the decision changes as it is typed. |
| [`product/editor/state.ts`](src/components/product/editor/state.ts) | The chart's declaration: a read-only editor has no `save` at all. Declared again when the decision changes, it keeps its place. |
| [`bulk-price/state.ts`](src/components/bulk-price/state.ts) | Declared with `apply` only under the grant to update prices; a guard reads the limit's decision when `apply` arrives. |
| [`session/props.ts`](src/components/session/props.ts) | The role in the header is the snapshot's. |
| [`product/remove-link/acl.ts`](src/components/product/remove-link/acl.ts), [`product/remove/acl.ts`](src/components/product/remove/acl.ts) | The `deletions` flag, a kill switch, read inside the rule: paused deletions are not allowed, and the dialog says why. |

Each component follows only the parts of the snapshot it reads, so a sign-in renders again only the components whose answer changed.

## One service, toured

[`src/services/products/`](src/services/products):

```
products/
  index.ts      The operations: search, get, reviews, categories, save, create, remove.
  meta.ts       Which operations read, and what each write makes stale, by reference.
  overlay.ts    Pure functions that lay local changes over what the API answered.
  types.ts      The shapes.
```

An operation receives the clients and returns a function:

```ts
export const save =
  ({ clients: { api, local } }) =>
  async ({ id, changes, version }) => {
    await api.put(`/auth/products/${id}`, changes, { auth: true })
    return { id, version: await local.edit(id, changes, version) }
  }
```

[`meta.ts`](src/services/products/meta.ts) is the whole cache policy:

```ts
export default ({ clients: { local }, services: { products } }) => ({
  search: { reads: true, follows: (stale) => local.changed(stale) },
  get: { reads: true, follows: (stale) => local.changed(stale) },
  save: {
    invalidates: [products.search, products.get],
    optimistic: [
      update(products.search, (page, { id, changes }) => changed(page, id, changes)),
      update(products.get, (product, { id, changes }) => (product.id === id ? edited(product, changes) : product)),
    ],
  },
  // …
})
```

The catalogue's `async.ts` calls `services.products.search`. The framework records that, so when a save succeeds anywhere, the page of the catalogue on screen reads again. No component declares a dependency, and no component calls an invalidation.

- `optimistic` shows a save at once, in the list and in the product's dialog. Writes on their way are kept in order over the server's last answer, so a failed one is taken out and the others stay.
- When a save succeeds, the other tabs hear which reads it made stale, through a `BroadcastChannel`, and read them again.
- `follows` makes a read stale when its source says so: here, another tab's change to the local overlay, once it can be read.

## Clients, and swapping the world

Clients are injected, never imported by components or by each other's callers. That is how tests, agents and people change the world a component sees.

| Client | What it is |
|---|---|
| [`dummyjson`](src/clients/dummyjson) | `fetch` with the access token, one shared token refresh on a 401 (one across tabs too, under a Web Lock), retries with backoff for 5xx and 429, `AbortSignal` honoured, and the network lab's faults. The session is the browser's: every tab shares it. |
| [`memory`](src/clients/memory) | The same client code on another wire: a function that answers DummyJSON's endpoints from fixtures. Its session and local changes are kept apart from the real world's, under `memory:` in localStorage, so its tabs share them as the real world's do. The reads of the session and of the products follow the `storage` event, so another tab's change is read once it can be. |
| [`api`](src/clients/api) | What services use. One line chooses between the two above. |
| [`local`](src/clients/local) | A browser store for what DummyJSON does not keep. It echoes writes and persists nothing, so edits, creations and deletions are kept here as an overlay, with a version per product. |
| [`tracker`](src/clients/tracker) | A destination for the framework's pipelines: interactions and failures, for the network lab to show. |
| [`flags`](src/clients/flags) | OpenFeature. In the DummyJSON world, with GrowthBook's client key in the build (`VITE_GROWTHBOOK_CLIENT_KEY`), GrowthBook serves the flags and streams every change made in its dashboard to every tab, through a small provider on its SDK ([`growthbook.ts`](src/clients/flags/growthbook.ts)), loaded only then. Otherwise OpenFeature's in-memory provider serves the flags of [`definitions.ts`](src/clients/flags/definitions.ts), each with the ways it can be served: stock counting to admins first, deletions on or paused, and the bulk change asking again above 10% for moderators. In memory, the way each is served is kept in localStorage, so every tab's provider hears a change, as each would hear GrowthBook's stream. |

Add `?world=memory` to the address and the app runs with no network: same services, same flows, same components. The unit tests and the end-to-end tests use that world, so CI does not depend on DummyJSON being up.

## How the checks catch mistakes

These are real messages from `npm run typecheck`, each from a one-line mistake.

An event the statechart does not have, sent from a render:

```
src/components/product/editor/render.tsx:98:70 - error TS2820: Type '"keepMein"' is not assignable to type
'"close" | "retry" | "edit" | "save" | "discard" | "keepEditing" | "keepMine" | "takeTheirs"'. Did you mean '"keepMine"'?
```

A parent that does not pass what the child's `props.ts` declares:

```
src/components/catalogue/render.tsx:34:12 - error TS2769: No overload matches this call.
    Property 'filters' is missing in type '{ key: number; product: Listed; }' but required in type 'Props'.
  src/components/catalogue/components/product-row/props.ts:7:40
    7 export type Props = { product: Listed; filters: Filters }
```

A mistyped operation in a service's `meta.ts`, which would otherwise leave a read uncached without a sound:

```
src/services/products/meta.ts:7:3 - error TS2561: Object literal may only specify known properties, but 'serach' does not exist
in type 'ServiceMeta<typeof import(".../src/services/products/index")>'. Did you mean to write 'search'?
```

A helper component declared inside a render file, where its handlers would not be tracked:

```
src/components/product/remove/render.tsx:3: holds a second component, JSX outside the default export (Spinner):
one component per file, so give it a folder of its own, with a render.tsx
```

The last one is not a type error. It is a convention check, and it fails the same command.

A message called without a value its ICU needs, and a translation that drops it:

```
src/components/catalogue/props.ts:21:30 - error TS2345: Argument of type '{ page: number; }' is not assignable to parameter of
type '{ page: number; pages: number; }'.
  Property 'pages' is missing in type '{ page: number; }' but required in type '{ page: number; pages: number; }'.

src/components/catalogue/i18n/pt-BR.json: "components/catalogue/paging/page" loses {pages}
```

Nobody wrote the type `{ page: number; pages: number }`: it is read from `'Page {page, number} of {pages, number}'` in the folder's `i18n.ts`.

## Tests at the seams

`npm test` runs about 130 tests in a few seconds: over 110 in Vitest, and 20 for the plugin in Node. A few of them, by what they pin down:

- [`editor/state.test.ts`](src/components/product/editor/state.test.ts): "closing with unsaved changes asks first", "a save refused as a conflict keeps the changes". The flow runs as the framework runs it, with services the test passes in.
- [`app/props.test.ts`](src/components/app/props.test.ts): "changing the catalogue needs a session", as a table over one pure function.
- [`products.test.ts`](src/services/products/products.test.ts): the services against the memory client: "a save from an older version is refused as a conflict".
- [`http.test.ts`](src/clients/dummyjson/http.test.ts): the client on a bad network: "requests that meet a 401 at the same time share one refresh".
- [`framework/runtime/__tests__/`](framework/runtime/__tests__): the framework's own guarantees.

The end-to-end tests ([`e2e/flows.spec.ts`](e2e/flows.spec.ts)) drive the production build. After each action they wait on one promise, `window.__framework.idle()`, then look once. It resolves when no read or write is pending, no view or skin is loading, no operation is running and no placeholder is on screen. A flow across two tabs also waits on `window.__framework.fromTab()`, which resolves once a tab has handled another's message. There are no sleeps and no retried assertions, with one stated exception for a list that refreshes on a timer.

## The network lab

"Network lab" in the header opens a panel that changes the API client's settings while the app runs. It stays usable while a dialog is open.

| Try | Watch |
|---|---|
| Latency at 1500 ms, then change a filter | The page keeps showing while the next one is read; a bar moves under the header. Open a product: the dialog has its placeholder, and its reviews have their own. |
| "Requests that fail" at 50% | The API client's list shows retries with backoff. Most reads still succeed. |
| "Every request answers 500", then change a filter | The catalogue's `error.tsx` shows, with "Try again". The failure arrives once in the pipeline, as a toast tagged with the layer and the operation. |
| The bulk price change with failures on | Per-product progress, the failed ones listed, and "Try the failed again". |
| Sign in, then wait | The access token lives one minute. The header counts it down and refreshes it 15 seconds before it expires. |
| "Expire the access token", then save an edit | The save meets a 401, the client refreshes once, and the save goes again. The list shows all three requests. |
| "Revoke the refresh token" as well | The save's refresh is refused: it fails with "Your session has expired", and the editor keeps the changes. When the header's own refresh comes due, the session ends there too, and the sign-in dialog opens over the editor. |
| "Sell out the product being edited", then save | A conflict: somebody else saved meanwhile. Keep yours, or take theirs. Two tabs on the same product do the same thing for real. |
| The "Inspector" tab, after pressing a row's + | What the press did, as the pipelines carried it: the handler with the file and line where it was written, the write it sent, the change shown at once, the list worked out again from the cache, the write done, the reads it made stale and read again, and the message to the other tabs. No render contains tracking code; the Vite plugin rewrites them. |
| "Every request answers 500", then press a row's + | The count moves at once, then goes back when the server refuses it; the inspector shows the change taken back, and the toast the failure. |
| Two tabs, signed in in one | The other follows: who is signed in, what they may do, every count and save. Sign out in either, and both are. |
| The "Flags" tab: stock count served to "Nobody" | The rows' − and + go, in every tab, and nothing else renders. "Admins only" brings them back for Emily; sign in as Olivia and they are not hers. |
| The "Flags" tab: deletions "Paused" | The delete links go, and a delete dialog opened from its address says deletions are paused. The rule is in `acl.ts`, so everything below follows `acl.allowed` without reading the flag. |
| Bulk change by 15%, as Olivia | Moderators are asked a second time above 10%, others above 50% (the `largeChangeAt` flag, read by the chart's guard). |

DummyJSON allows about 100 requests in a window it does not state, so sustained stress can earn a real 429. The client retries those too.

## The states gallery

"States", in the header, opens `#/states`: every component with a `state.ts`, in each state of its chart, one frame per state, from the folders alone. Each frame is the component held in that state: its chart is not started, so nothing moves. A state that needs more than the chart starts with (a product read, a failure's message, the form's values) gets it from the examples its `state.ts` exports. The frames follow the page's language.

## What renders, and when

A component renders again only for what its files read. The plugin reads what each layer file destructures, and the framework follows those sources and no other:

- **The locale.** Only components with an `i18n.ts`, or that read `intl` or `locale`. The page switches in one commit, once every component on screen has its messages.
- **The person, the backend's snapshot and the flags.** Only the parts each component reads. A folder's `acl.ts` that reads only `acl` and `flags` is decided once per change, and an instance renders again only when its decision changes.
- **The route.** Each field has a context of its own. The catalogue follows its filters and its page; a dialog opening over it does not render it. A view follows the fields its files read too: the lab's sell-out button follows `edit`, and the lab around it none.
- **The form.** Only the values a component's files read. The editor's fields hold what is typed, as native fields do, so a key renders the field alone.
- **The chart.** Only when it shows something else: other states, or another context. A state entered again, or a service starting, renders nothing.

Two rules hold for every render:

- **Unchanged parts are reused.** What a render gets keeps every part that is still equal, and a render that would get the same is not called. What it returns shares every element equal to the last one, so React skips it.
- **Handlers are stable.** Each handler keeps one function for the instance's life, which calls the last committed closure. A function in the JSX that uses nothing of the render (a list's `{(item) => <Item … />}`) is made once, outside it; one that reads the render's values is kept while those values are the same.

[`perf/`](perf/README.md) measures this. `npm run perf` drives a visit of 29 steps, and ten more beyond it, through a profiling build. It counts every render, the ones that changed nothing on the page, and the ones React threw away. Its README holds the numbers after each change. For the last one:
- framework components re-rendered 246 times, 5 of them changing nothing (248 and 9 two changes before);
- a product's modal opens once, with its skeleton inside it (it opened twice);
- the network lab, open and idle, renders nothing (two renders a second before);
- typing six keys in the editor renders no framework component, and 50 of react-aria's (602 at the baseline).

## Storybook

`npm run storybook` shows every component folder at http://localhost:6006, and nobody writes a story. The framework writes one file per folder ([`framework/storybook/`](framework/storybook)), and writes them again as folders and files come and go:

- **The folder's page** lists its files, each with its job, what its functions are given and which sources the component follows because of them, as the plugin reads them; then its chart's states with their descriptions, its stories, and every file's source.
- **A story per example** its `props.ts` exports (what a parent passes, the address it needs), or one of the component as it runs.
- **A story per state** of its chart, held in that state with `state.ts`'s example, as the states gallery shows it.

Every story renders inside the app's `Root`, in the memory world ([`.storybook/preview.tsx`](.storybook/preview.tsx)). The toolbar chooses the language and who is signed in: the story signs in first with that role's demo account, so the session, what may be done and the flags agree. A story starts at the address its example names, and then follows its links. The states gallery itself is left out: its frames are pages of the app's own shell.

## Running it

Node 20.19 or later. The unit tests need a newer one: CI runs everything on Node 24.

```sh
npm ci
npm run dev        # http://localhost:5180, on DummyJSON
                   # http://localhost:5180/?world=memory, with no network
```

GrowthBook serves the DummyJSON world's flags when `.env.local` holds its client key, `VITE_GROWTHBOOK_CLIENT_KEY=sdk-…` (GrowthBook's wizard, `npx @growthbook/wizard --language react`, writes it). Without it, the in-memory provider serves them.

| Script | What it does |
|---|---|
| `npm run dev` | The dev server. |
| `npm run build`, `npm run preview` | The production build, and a server for it on port 5181. |
| `npm run typecheck` | Writes the component folders' declarations, runs `tsc` for the tooling, and runs the framework's checker for the app: TypeScript with the injected types, plus the convention checks. |
| `npm test` | The unit tests: pure functions, flows, services on the memory client, the API client, and the framework's runtime. |
| `npm run check` | `typecheck`, `test` and `build`. |
| `npm run e2e` | Builds, serves, and drives the main flows in Chromium (and WebKit in CI). Run `npx playwright install chromium` once. |
| `npm run perf` | Builds with React's profiling build and counts the renders of each step of a flow ([`perf/`](perf/README.md)). |
| `npm run storybook`, `npm run build-storybook` | Storybook, on port 6006, and its static build in `storybook-static/`. `npm run stories` writes the story files alone; `typecheck` runs it and checks them. |

For editor support, use the workspace's TypeScript ("TypeScript: Select TypeScript Version" in VS Code), so that the language-service plugin in `tsconfig.json` loads. See [the framework's README](framework/README.md#editors).

## Review

Commit [`8dbdf91`](https://github.com/fernandocamargo/framework-demo/commit/8dbdf91) is a behaviour change, made the way the framework intends:

> `feat(bulk-price): ask again before a price change above 50%`

Its diff is a guard and a described state in `state.ts`, the question's text in `render.tsx`, and a test. Nothing else moved, because nothing else knows. A reviewer reads the rule, the place it applies, and the proof.

Compare `git show 8dbdf91 --stat` with what the same change costs in a component that holds its flow in hooks.

## Beyond TypeScript

Nothing here depends on React or on TypeScript in particular. The same contracts need three things from a language's tooling:

1. **An AST that tools can read**, to find the folders' exports and check the conventions.
2. **A build step that can rewrite it**, to wire the folders and to add what nobody should write by hand (here: tracking on every handler).
3. **An editor protocol that can be taught**, so the injected types and the convention mistakes show while typing, not only in CI.

Several ecosystems have all three:

| Ecosystem | Read and rewrite | Teach the editor |
|---|---|---|
| C# | Roslyn source generators | Roslyn analyzers, which run in the IDE and in the build |
| Kotlin | KSP processors, compiler plugins | The same compiler plugins, in the IDE |
| Rust | Procedural macros | rust-analyzer expands them |
| Swift | Swift macros | SourceKit expands them |
| Python | `ast`, import hooks | A type-checker plugin (mypy), or stubs generated beside the sources |

The mechanism differs. The idea carries: give each kind of decision one place, type the seams between the places, and let the build do the wiring.

## What is not here

- The `Route` and the hash router in [`src/main.tsx`](src/main.tsx) stand in for a routing layer. `form.ts` stands in for a form manager.
- Services receive no `AbortSignal` from the data layer yet. The client honours one; a stale answer is ignored by its cache key instead.
- The local overlay keeps the API's paging, so a page that lost a product is one short.
- The live site's build has no GrowthBook key, so its flags come from memory.
- Offline use, and where the session and other stored data live, are not designed yet.
- The framework is a working sketch, not a library.

## Layout

```
framework/          The framework: plugin/, runtime/, typescript/, shared/, storybook/. See its README.
src/
  main.tsx          The shell: which world and locale, the router's stand-in, Root, failures as toasts.
  locales.ts        The locales the app speaks, and `?lang=` in the address.
  env.d.ts          What this app injects: Env, Route, Flags, Navigation.
  address.ts        The address, as the route and back.
  reads.ts          What Root reads for the app: who is signed in, what they may do, their flags.
  base.css          Design tokens and the look of the controls.
  clients/          Transports.
  services/         Operations, and what makes what stale.
  components/       Component folders.
e2e/                The end-to-end flows.
perf/               Render cycles, step by step, against a baseline.
.storybook/         Which folders Storybook shows, and the stage its stories render on.
```
