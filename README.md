# Stockroom: requirements held by code

A small back office (a product catalogue over [DummyJSON](https://dummyjson.com)) built on a small React framework. The app is the example. The framework is the point: it is an attempt to make the mechanical part of building software checkable, so that people and agents who hand work to each other have something firmer than prose to agree on.

It runs at https://fernandocamargo.github.io/framework-demo/. An explainer of the idea, written for a team and already outdated in places, is at [explainer/](https://fernandocamargo.github.io/framework-demo/explainer/) (its source is [`public/explainer/index.html`](public/explainer/index.html)).

It is meant to be read in an evening. The framework is about 3,000 lines in [`framework/`](framework/README.md); the app is about 4,000 in [`src/`](src), a third of it CSS and fixtures.

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
| Layer file | A file with a fixed name and job inside a component folder: `render.tsx`, `props.ts`, `async.ts`, `state.ts`, `form.ts`, `placeholder.tsx`, `error.tsx`. |
| `props.ts` | The module's interface. `export type Props` says what a parent passes; the default export shapes what the render gets. |
| Client | A transport: how the app reaches a system. A folder under `clients/`. |
| Service | The operations on one resource, written against clients. A folder under `services/`. |
| Injection | What the framework hands to a layer file's functions: `clients`, `services`, `route`, `navigation`, `form`. Components never import a client or a service. |
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
export default ({ services: { products } }) => ({
  search: { reads: true },
  get: { reads: true },
  save: { invalidates: [products.search, products.get] },
  // …
})
```

The catalogue's `async.ts` calls `services.products.search`. The framework records that, so when a save succeeds anywhere, the page of the catalogue on screen reads again. No component declares a dependency, and no component calls an invalidation.

## Clients, and swapping the world

Clients are injected, never imported by components or by each other's callers. That is how tests, agents and people change the world a component sees.

| Client | What it is |
|---|---|
| [`dummyjson`](src/clients/dummyjson) | `fetch` with the access token, one shared token refresh on a 401, retries with backoff for 5xx and 429, `AbortSignal` honoured, and the network lab's faults. |
| [`memory`](src/clients/memory) | The same client code on another wire: a function that answers DummyJSON's endpoints from fixtures. |
| [`api`](src/clients/api) | What services use. One line chooses between the two above. |
| [`local`](src/clients/local) | A browser store for what DummyJSON does not keep. It echoes writes and persists nothing, so edits, creations and deletions are kept here as an overlay, with a version per product. |
| [`tracker`](src/clients/tracker) | A destination for the framework's pipelines: interactions and failures, for the network lab to show. |

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

## Tests at the seams

`npm test` runs about 90 tests in about a second. A few of them, by what they pin down:

- [`editor/state.test.ts`](src/components/product/editor/state.test.ts): "closing with unsaved changes asks first", "a save refused as a conflict keeps the changes". The flow runs as the framework runs it, with services the test passes in.
- [`app/props.test.ts`](src/components/app/props.test.ts): "changing the catalogue needs a session", as a table over one pure function.
- [`products.test.ts`](src/services/products/products.test.ts): the services against the memory client: "a save from an older version is refused as a conflict".
- [`http.test.ts`](src/clients/dummyjson/http.test.ts): the client on a bad network: "requests that meet a 401 at the same time share one refresh".
- [`framework/runtime/__tests__/`](framework/runtime/__tests__): the framework's own guarantees.

The end-to-end tests ([`e2e/flows.spec.ts`](e2e/flows.spec.ts)) drive the production build. After each action they wait on one promise, `window.__framework.idle()`, then look once. It resolves when no read or write is pending, no view or skin is loading, no operation is running and no placeholder is on screen. There are no sleeps and no retried assertions, with one stated exception for a list that refreshes on a timer.

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
| The "Interactions and failures" tab | Every `on…` handler in a render is tracked, with the file and line where it was written. No render contains tracking code; the Vite plugin rewrites them. |

DummyJSON allows about 100 requests in a window it does not state, so sustained stress can earn a real 429. The client retries those too.

## Running it

Node 20.19 or later.

```sh
npm ci
npm run dev        # http://localhost:5180, on DummyJSON
                   # http://localhost:5180/?world=memory, with no network
```

| Script | What it does |
|---|---|
| `npm run dev` | The dev server. |
| `npm run build`, `npm run preview` | The production build, and a server for it on port 5181. |
| `npm run typecheck` | Writes the component folders' declarations, runs `tsc` for the tooling, and runs the framework's checker for the app: TypeScript with the injected types, plus the convention checks. |
| `npm test` | The unit tests: pure functions, flows, services on the memory client, the API client, and the framework's runtime. |
| `npm run check` | `typecheck`, `test` and `build`. |
| `npm run e2e` | Builds, serves, and drives the main flows in Chromium (and WebKit in CI). Run `npx playwright install chromium` once. |

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
- The framework is a working sketch, not a library.

## Layout

```
framework/          The framework: plugin/, runtime/, typescript/, shared/. See its README.
src/
  main.tsx          The shell: which world, the router's stand-in, Root, failures as toasts.
  env.d.ts          What this app injects: Env, Route, Navigation.
  address.ts        The address, as the route and back.
  base.css          Design tokens and the look of the controls.
  clients/          Transports.
  services/         Operations, and what makes what stale.
  components/       Component folders.
e2e/                The end-to-end flows.
```
