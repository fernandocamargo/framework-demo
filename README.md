# Stockroom: requirements held by code

A small back office over [DummyJSON](https://dummyjson.com) (a product catalogue, a stock report, a map of where the orders go) built on a small React framework. The app is the example. The framework is the point: it is an attempt to make the mechanical part of building software checkable, so that people and agents who hand work to each other have something firmer than prose to agree on.

It runs at https://fernandocamargo.github.io/framework-demo/. An explainer of the idea, written for a team, is at [explainer/](https://fernandocamargo.github.io/framework-demo/explainer/) (its source is [`public/explainer/index.html`](public/explainer/index.html)). Every component folder is in its [Storybook](https://fernandocamargo.github.io/framework-demo/storybook/), where nobody wrote a story.

It is meant to be read in an evening or two. The framework is about 7,100 lines in [`framework/`](framework/README.md); the app is about 13,000 in [`src/`](src), half of it CSS, fixtures and translations (tests left out of both).

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

| Word             | Meaning                                                                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component folder | The module. A folder under `components/` with a `render.tsx`. Importing the folder gives the component. Its path (`components/product/editor`) is its identity and its CSS class.                                                                                                                      |
| Layer file       | A file with a fixed name and job inside a component folder: `render.tsx`, `props.ts`, `async.ts`, `state.ts`, `form.ts`, `i18n.ts`, `acl.ts`, `shortcuts.ts`, `placeholder.tsx`, `error.tsx`.                                                                                                          |
| `shortcuts.ts`   | The keys a component answers while it is on screen, translated, each sending a chart's event, focusing an element or running a function, and working only while the chart takes the event or its `when` holds. `?` lists them; the command palette (⌘K) runs them.                                     |
| `acl.ts`         | Whether what a component offers may be done, as a boolean. The component and everything below it get `acl.allowed`, until a folder below says otherwise.                                                                                                                                               |
| Flags            | What the person signed in gets of each feature flag, as `flags`, through OpenFeature. Any file may read them; a component follows only the flags it reads.                                                                                                                                             |
| `props.ts`       | The module's interface. `export type Props` says what a parent passes; the default export shapes what the render gets.                                                                                                                                                                                 |
| Client           | A transport: how the app reaches a system. A folder under `clients/`.                                                                                                                                                                                                                                  |
| Service          | The operations on one resource, written against clients. A folder under `services/`.                                                                                                                                                                                                                   |
| Injection        | What the framework hands to a layer file's functions: `clients`, `services`, `route`, `navigation`, `form`, `i18n`, `intl`, `locale`. Components never import a client or a service. A component follows only what its files read: one that does not read the locale never renders for a change of it. |
| Messages         | A component's words, in its `i18n.ts`, as an object of any shape; translations beside it in `i18n/<locale>.json`, loaded when a component of the folder first shows in that locale.                                                                                                                    |
| Skin             | A component's plain CSS, nested under its class: `style/skins/<name>/index.ts`. It styles what the markup says each piece is (HTML, ARIA, react-aria's anatomy, schema.org's microdata), never a class for its look.                                                                                   |

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
  style/skins/<name>/index.ts   Plain CSS, one sheet per skin: default, broadsheet, blueprint.
```

The flow reads as the requirement does ([`state.ts`](src/components/product/editor/state.ts), shortened):

```ts
export const unsaved = ({ form }) => form.unsaved;
export const isConflict = ({ event }) => event.error instanceof Error && event.error.name === 'ConflictError';
export const changesToSave = ({ form, context, route }) => ({
  id: route.edit ?? 0,
  changes: form.payload(),
  version: context.version,
});

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
      onError: [
        { guard: isConflict, target: 'conflict' },
        { target: 'failed', actions: rememberError },
      ],
    },
  },
  // …
});
```

There are no type annotations in that file, and none are missing. The TypeScript plugin types `form`, `context`, `route`, `event` and `services` from the folder's other files and from the app's clients and services. The render receives `state` with one boolean per state and a `send` that accepts only this chart's events.

The same folder shape holds a wizard ([`bulk-price/`](src/components/bulk-price)), a session with token refresh ([`session/`](src/components/session)), and a list row with no flow at all ([`product-row/`](src/components/catalogue/components/product-row)).

## Rules in different places

The app does not own its permissions. A backend sends a snapshot of them (a role, grants by resource and action, limits), and the framework carries it to every file that reads `acl`, with `allowed` on it: the decision of the nearest `acl.ts` above. DummyJSON has no permissions endpoint, so the API client answers `/auth/permissions` from the user's role, as a backend would ([`clients/permissions.ts`](src/clients/permissions.ts)). The sign-in dialog offers one account per role (Emily, admin; Olivia, moderator; Avery, user).

Each consumer tests the snapshot against what else it knows:

| Where                                                                                                                                      | Test                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`app/acl.ts`](src/components/app/acl.ts)                                                                                                  | Changing the catalogue needs the grant to update products. Every component below inherits the decision: the catalogue hides its actions, a row its edit link, the editor locks its fields. |
| [`product/remove-link/acl.ts`](src/components/product/remove-link/acl.ts)                                                                  | One link, inside every row and the product dialog, narrower: it needs the grant to delete.                                                                                                 |
| [`product/remove/acl.ts`](src/components/product/remove/acl.ts)                                                                            | The same for the dialog, which an address (`?remove=4`) can open for anyone.                                                                                                               |
| [`bulk-price/acl.ts`](src/components/bulk-price/acl.ts)                                                                                    | The backend's limit on a price change, against the percentage in the form: the decision changes as it is typed.                                                                            |
| [`product/editor/state.ts`](src/components/product/editor/state.ts)                                                                        | The chart's declaration: a read-only editor has no `save` at all. Declared again when the decision changes, it keeps its place.                                                            |
| [`bulk-price/state.ts`](src/components/bulk-price/state.ts)                                                                                | Declared with `apply` only under the grant to update prices; a guard reads the limit's decision when `apply` arrives.                                                                      |
| [`session/props.ts`](src/components/session/props.ts)                                                                                      | The role in the header is the snapshot's.                                                                                                                                                  |
| [`product/remove-link/acl.ts`](src/components/product/remove-link/acl.ts), [`product/remove/acl.ts`](src/components/product/remove/acl.ts) | The `deletions` flag, a kill switch, read inside the rule: paused deletions are not allowed, and the dialog says why.                                                                      |

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
    await api.put(`/auth/products/${id}`, changes, { auth: true });
    return { id, version: await local.edit(id, changes, version) };
  };
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
});
```

The catalogue's `async.ts` calls `services.products.search`. The framework records that, so when a save succeeds anywhere, the page of the catalogue on screen reads again. No component declares a dependency, and no component calls an invalidation.

- `optimistic` shows a save at once, in the list and in the product's dialog. Writes on their way are kept in order over the server's last answer, so a failed one is taken out and the others stay.
- When a save succeeds, the other tabs hear which reads it made stale, through a `BroadcastChannel`, and read them again.
- `follows` makes a read stale when its source says so: here, another tab's change to the local overlay, once it can be read.

## Clients, and swapping the world

Clients are injected, never imported by components or by each other's callers. That is how tests, agents and people change the world a component sees.

| Client                               | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`dummyjson`](src/clients/dummyjson) | `fetch` with the access token, one shared token refresh on a 401 (one across tabs too, under a Web Lock), retries with backoff for 5xx and 429, `AbortSignal` honoured, and the network lab's faults. The session is the browser's: every tab shares it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [`memory`](src/clients/memory)       | The same client code on another wire: a function that answers DummyJSON's endpoints from fixtures. Its session and local changes are kept apart from the real world's, under `memory:` in localStorage, so its tabs share them as the real world's do. The reads of the session and of the products follow the `storage` event, so another tab's change is read once it can be.                                                                                                                                                                                                                                                                                                                                                             |
| [`api`](src/clients/api)             | What services use. One line chooses between the two above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [`local`](src/clients/local)         | A browser store for what DummyJSON does not keep. It echoes writes and persists nothing, so edits, creations and deletions are kept here as an overlay, with a version per product.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [`tracker`](src/clients/tracker)     | A destination for the framework's pipelines: interactions and failures, for the network lab to show.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [`flags`](src/clients/flags)         | OpenFeature. In the DummyJSON world, with GrowthBook's client key in the build (`VITE_GROWTHBOOK_CLIENT_KEY`), GrowthBook serves the flags and streams every change made in its dashboard to every tab, through a small provider on its SDK ([`growthbook.ts`](src/clients/flags/growthbook.ts)), loaded only then. Otherwise OpenFeature's in-memory provider serves the flags of [`definitions.ts`](src/clients/flags/definitions.ts), each with the ways it can be served: stock counting to admins first, deletions on or paused, and the bulk change asking again above 10% for moderators. In memory, the way each is served is kept in localStorage, so every tab's provider hears a change, as each would hear GrowthBook's stream. |

Add `?world=memory` to the address and the app runs with no network: same services, same flows, same components. The unit tests and the end-to-end tests use that world, so CI does not depend on DummyJSON being up.

## Pages, and what a feature costs

The hash's path names the page ([`d53b9c5`](https://github.com/fernandocamargo/framework-demo/commit/d53b9c5)): `#/products`, the catalogue; `#/report`, the stock report; `#/orders`, where the orders go; `#/states`, the gallery. Filters and dialogs stay in its query, so a link to a product, a state or an order opens the same view for anyone who may see it ([`address.ts`](src/address.ts)).

Five features came after the layers, to see what one costs here; the last, orders on a map, came in two steps. They landed in [twelve commits](https://github.com/fernandocamargo/framework-demo/compare/1b5fc43...a313dbc), each with a message that argues for it: what it shows, what that proves and, for most, what it cost and how it was checked. The framework's plugin, which wires a folder, did not change; its runtime grew twice, as told below the table.

| Feature                                                                                                                                                                                | Try                                                                      | What it cost                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A third skin, Blueprint ([`47c3c85`](https://github.com/fernandocamargo/framework-demo/commit/47c3c85), [`cfe4cda`](https://github.com/fernandocamargo/framework-demo/commit/cfe4cda)) | `?skin=blueprint`, or the header's switch                                | A sheet for the page and one per folder, most of them a line that re-exports the default. Beyond the sheets, only its name in `skins.ts` and in the switch, two imports of its page sheet, and tests: the markup already said what each piece is ([Three skins](#three-skins-one-markup)).                                                                                                                                                                                                                                                                |
| The stock report ([`2482683`](https://github.com/fernandocamargo/framework-demo/commit/2482683))                                                                                       | `#/report` in each skin; count a unit in another tab                     | A folder, one word in `SECTIONS` and one read in the products service. Its headline and figures are a pure function ([`summary.ts`](src/components/report/summary.ts)), tested without React. It follows the other tabs' counts with no wiring in its folder: the new read is named in `meta.ts`, once to follow the other tabs' changes and once in each of the six writes that make it stale.                                                                                                                                                           |
| A guided tour ([`4ae0b89`](https://github.com/fernandocamargo/framework-demo/commit/4ae0b89))                                                                                          | "Take the tour", in the header                                           | One folder, and the fix in the framework it led to (below). Its chart of eleven states calls the services the rest of the app calls (`lab.change`, `auth.signIn`, `flags.serve`) and moves the same address, so it drives the network, the session, the flags, the skin and the locale with no special access to any of them. Leaving puts the page back as it was.                                                                                                                                                                                       |
| A command palette ([`297a5d6`](https://github.com/fernandocamargo/framework-demo/commit/297a5d6))                                                                                      | ⌘K (Ctrl K elsewhere), over anything, a dialog included                  | One folder. Its first group, what can be done on this page, is not written for it: those are the keys the folders' `shortcuts.ts` already declare, each run through `run()`, which the framework gained for it in a commit of its own ([`fa593c7`](https://github.com/fernandocamargo/framework-demo/commit/fa593c7)). The other groups (the pages, the skins and languages, signing in, the products that match what is typed) its `props.ts` lists itself. Over the editor it offers "Save the product ⌘S", and only while the editor's chart can save. |
| Orders ([`e1f7c79`](https://github.com/fernandocamargo/framework-demo/commit/e1f7c79), [`9ef72e0`](https://github.com/fernandocamargo/framework-demo/commit/9ef72e0))                  | `#/orders` as Emily, Olivia and Avery; then `?region=TX`, and `?cart=12` | A service that joins DummyJSON's carts with their customers, with fixtures for the memory world; three folders under a page folder; two address fields and one word in `SECTIONS`. The map is 51 tiles in markup, each a schema.org Observation whose count is a `<meter>` the skin turns into a fill. Orders are for admins and moderators, and a customer's name and street for the grant to read customers, so Olivia sees "Amara A.". A plain user who types `?cart=12` gets nothing: the app does not mount the order's reader.                      |
| A live map ([`a313dbc`](https://github.com/fernandocamargo/framework-demo/commit/a313dbc))                                                                                             | The network lab's Flags tab: "Live map" on, then off                     | A flag, one dependency (MapLibre, loaded the first time the map shows), and a React ref callback ([`src/widgets/live-map/`](src/widgets/live-map)) that is given no data: it reads the figure's schema.org items, as a search engine would, and draws a circle per state. The tiles stay, as its legend and as what a keyboard and a screen reader use.                                                                                                                                                                                                   |

The tour found one thing the framework lacked, fixed in a commit of its own ([`ea1a3f6`](https://github.com/fernandocamargo/framework-demo/commit/ea1a3f6)): a folder showing its error stayed failed after the address moved on. It now tries again when the route changes, as "Try again" would.

### Who wrote them

The features were also a test: can Haiku 5.5, given a brief, build on this framework? Each feature was written by a model in a run of its own, from a brief; three of the eight runs stopped to ask, and were answered. Each was checked before it landed. Every number below comes from the session's logs and from the commits, and two audits checked each one against them. "Green" is what a run's own checks said at the time.

Fable 5.2 chose the features and wrote a brief for each: a file-by-file specification with names, signatures and fragments of code, 1,066 to 2,662 words. Counted as exact lines, a brief holds 0% to 19% of the lines its run wrote. The session that dispatched and supervised the runs, on Opus 5.5, added notes on the repository and a few rules to each brief, and rewrote the live map's for a ref callback. Seven runs were on Haiku 5.5 and one on Sonnet 5.5. The seven Haiku runs took an hour of running time between them, their checks and end-to-end suites included: 34 minutes on the clock, some side by side.

| Run                     | Model      | At its first report                                                           | Its lines that landed | Lines the supervising session wrote                                                                                                                                            |
| ----------------------- | ---------- | ----------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Blueprint               | Haiku 5.5  | Green, with a flaw it reported and left unsolved                              | 226                   | 82: room for the labels in the product row (the flaw it reported), the search bar, the page and the header; and one rule that names any type, in place of the run's twenty-two |
| The page in the address | Haiku 5.5  | Green                                                                         | 75                    | 0                                                                                                                                                                              |
| Orders: the service     | Haiku 5.5  | Green                                                                         | 455                   | 0                                                                                                                                                                              |
| Orders: the page        | Haiku 5.5  | Green                                                                         | 1,416                 | 53: a meter Chromium drew as a band and an address run together, neither reported; and the header, which had outgrown the page once every feature had a link in it             |
| The stock report        | Haiku 5.5  | Stopped: the feature changed a text an existing test reads, and it asked      | 835                   | 0                                                                                                                                                                              |
| The tour                | Haiku 5.5  | Stopped twice: a flaw in its brief, then a gap in the framework               | 718                   | 1, and the framework's retry: 53                                                                                                                                               |
| The palette             | Haiku 5.5  | Stopped: two things its brief had not foreseen, one in react-aria, one a test | 655, and `run()`: 58  | 8, and in `run()`: 79                                                                                                                                                          |
| The live map            | Sonnet 5.5 | Green, with a list of eight flaws and caveats of its own                      | 498                   | 29, all from its own list                                                                                                                                                      |
| **All**                 |            | **5 of 8 green**                                                              | **4,936 of 5,241**    | **305**                                                                                                                                                                        |

- **The lines.** The five features added 5,241 lines (the lockfile left out). Haiku 5.5 wrote 4,438 of them (84.7%), Sonnet 5.5 498 (9.5%), and the supervising session 305 (5.8%). Lines a run wrote on the supervising session's instruction count as the run's. Two runs landed byte for byte, and two more with none of their lines changed.
- **Stopping.** Every run was green at its last report: the check, and every end-to-end flow in Chromium and WebKit. The three that stopped on the way did not weaken a test to get there: each named the failing test and asked, and changed an existing expectation only when told to.
- **The framework.** Two features needed its runtime to grow, and the supervising session wrote most of that: 132 of the 190 lines added under `framework/`. The tour's retry is all the supervising session's. Haiku 5.5 wrote `run()` for the palette, as its brief asked; a review by Sonnet 5.5 found that with two instances of a folder on screen it ran the wrong one, and the supervising session fixed it, with a test.
- **The checks.** No run tripped one of the framework's convention checks. What they met were TypeScript errors (one from the framework's typing of what a render receives), lint's sort order, and failing unit and end-to-end tests.
- **In tokens.** Output, as the logs record it: the eight runs 496,615, and the review 7,348; the briefs 80,996; the supervising session 213,255, in the two stretches that dispatched the runs and landed them, 100 minutes in all, some of it on other work. Output is not cost: the supervising session also read twice the cached input the runs did (122.5 million tokens against 58.3 million), and the models' prices differ.

So on this framework Haiku 5.5 wrote most of five features, from Fable 5.2's briefs, with Opus 5.5 supervising: it answered the runs' questions and wrote the lines they did not. Sonnet 5.5 wrote the live map and reviewed the palette's change to the framework. None of this shows that Haiku 5.5 could have done without them.

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

`npm test` runs about 190 tests in a few seconds: over 160 in Vitest, and 20 for the plugin in Node. A few of them, by what they pin down:

- [`editor/state.test.ts`](src/components/product/editor/state.test.ts): "closing with unsaved changes asks first", "a save refused as a conflict keeps the changes". The flow runs as the framework runs it, with services the test passes in.
- [`app/props.test.ts`](src/components/app/props.test.ts): "changing the catalogue needs a session", and "an order does not open for someone who may not read orders, however the address names it", as tables over one pure function.
- [`products.test.ts`](src/services/products/products.test.ts): the services against the memory client: "a save from an older version is refused as a conflict".
- [`report/summary.test.ts`](src/components/report/summary.test.ts): the front page's headline, "anything out of stock leads the headline, counted".
- [`tour/state.test.ts`](src/components/tour/state.test.ts): "leaving puts back the locale and the skin the page had when the tour started".
- [`http.test.ts`](src/clients/dummyjson/http.test.ts): the client on a bad network: "requests that meet a 401 at the same time share one refresh".
- [`framework/runtime/__tests__/`](framework/runtime/__tests__): the framework's own guarantees.

The end-to-end tests ([`e2e/`](e2e)) drive the production build: the main flows ([`flows.spec.ts`](e2e/flows.spec.ts)), and one spec per feature (the report, the orders, the palette, the tour, the skins). After each action they wait on one promise, `window.__framework.idle()`, then look once. It resolves when no read or write is pending, no view or skin is loading, no operation is running and no placeholder is on screen. A flow across two tabs also waits on `window.__framework.fromTab()`, which resolves once a tab has handled another's message. There are no sleeps and no retried assertions, with one stated exception for a list that refreshes on a timer. [`e2e/microdata.spec.ts`](e2e/microdata.spec.ts) runs the framework's microdata check on every page the flows reach: the catalogue, a product, the editor, the dialogs and the lab name their pieces as schema.org does. The features' specs run it on their own pages, the orders' in every skin.

## The network lab

"Network lab" in the header opens a panel that changes the API client's settings while the app runs. It stays usable while a dialog is open.

| Try                                               | Watch                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Latency at 1500 ms, then change a filter          | The page keeps showing while the next one is read; a bar moves under the header. Open a product: the dialog has its placeholder, and its reviews have their own.                                                                                                                                                                                             |
| "Requests that fail" at 50%                       | The API client's list shows retries with backoff. Most reads still succeed.                                                                                                                                                                                                                                                                                  |
| "Every request answers 500", then change a filter | The catalogue's `error.tsx` shows, with "Try again". The failure arrives once in the pipeline, as a toast tagged with the layer and the operation.                                                                                                                                                                                                           |
| The bulk price change with failures on            | Per-product progress, the failed ones listed, and "Try the failed again".                                                                                                                                                                                                                                                                                    |
| Sign in, then wait                                | The access token lives one minute. The header counts it down and refreshes it 15 seconds before it expires.                                                                                                                                                                                                                                                  |
| "Expire the access token", then save an edit      | The save meets a 401, the client refreshes once, and the save goes again. The list shows all three requests.                                                                                                                                                                                                                                                 |
| "Revoke the refresh token" as well                | The save's refresh is refused: it fails with "Your session has expired", and the editor keeps the changes. When the header's own refresh comes due, the session ends there too, and the sign-in dialog opens over the editor.                                                                                                                                |
| "Sell out the product being edited", then save    | A conflict: somebody else saved meanwhile. Keep yours, or take theirs. Two tabs on the same product do the same thing for real.                                                                                                                                                                                                                              |
| The "Inspector" tab, after pressing a row's +     | What the press did, as the pipelines carried it: the handler with the file and line where it was written, the write it sent, the change shown at once, the list worked out again from the cache, the write done, the reads it made stale and read again, and the message to the other tabs. No render contains tracking code; the Vite plugin rewrites them. |
| "Every request answers 500", then press a row's + | The count moves at once, then goes back when the server refuses it; the inspector shows the change taken back, and the toast the failure.                                                                                                                                                                                                                    |
| Two tabs, signed in in one                        | The other follows: who is signed in, what they may do, every count and save. Sign out in either, and both are.                                                                                                                                                                                                                                               |
| The "Flags" tab: stock count served to "Nobody"   | The rows' − and + go, in every tab, and nothing else renders. "Admins only" brings them back for Emily; sign in as Olivia and they are not hers.                                                                                                                                                                                                             |
| The "Flags" tab: deletions "Paused"               | The delete links go, and a delete dialog opened from its address says deletions are paused. The rule is in `acl.ts`, so everything below follows `acl.allowed` without reading the flag.                                                                                                                                                                     |
| Bulk change by 15%, as Olivia                     | Moderators are asked a second time above 10%, others above 50% (the `largeChangeAt` flag, read by the chart's guard).                                                                                                                                                                                                                                        |
| The "Flags" tab: live map "On", on `#/orders`     | A map of the states appears over the tiles, a circle for each state with orders. A click on Texas's circle is a click on Texas's tile. "Off" takes the map away, with no reload.                                                                                                                                                                             |

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

[`perf/`](perf/README.md) measures this. `npm run perf` drives a visit of 29 steps, and ten more beyond it, through a profiling build; `VISIT=features` drives a second one over the report, the orders page, the palette and the tour. It counts every render, the ones that changed nothing on the page, and the ones React threw away. Its README holds the numbers after each change. Where they stand:

- framework components render again 252 times in the visit, 5 of them changing nothing. Broadsheet and the five features added 6, all at a switch of language, which reaches the three components they put in the header (the skin's switch, the tour, the palette), each changing the page;
- the second visit's 18 steps render framework components again 78 times, 3 of them changing nothing;
- no step of either visit has a frame over 50 ms or an interaction over 40 ms (`npm run perf:frames`);
- a product's modal opens once, with its skeleton inside it (it opened twice before the third rendering round);
- the network lab, open and idle, renders nothing (two renders a second before);
- typing six keys in the editor renders no framework component, and 50 of react-aria's (602 at the baseline).

## Three skins, one markup

The same app wears three skins, and `?skin=broadsheet` or `?skin=blueprint` (or the switch in the header) changes it in place. The default is a quiet back office. Broadsheet sets the shop as a newspaper: a masthead over a double rule, the catalogue as columns of products with greyscale photographs, a product as an article with a drop cap and its reviews as letters, the bulk change as the market page, the stock report as a front page, the orders' states as an engraving.

Blueprint draws the page as itself, on blue paper. Every item is outlined and tagged with its schema.org type (Product, Offer, Review, UpdateAction), every property with its name, and the values a page normally hides are written where they sit (`priceCurrency: USD`). Nobody built a debug mode: the markup already said all of it, so the skin only shows the names. One rule labels every type, so a type added later names itself.

Not one element or attribute changes between them; [`e2e/skins.spec.ts`](e2e/skins.spec.ts) and [`e2e/blueprint.spec.ts`](e2e/blueprint.spec.ts) check it. A skin is a sheet per component folder (`style/skins/<name>/index.ts`) and one for the page ([`src/broadsheet.css`](src/broadsheet.css), [`src/blueprint.css`](src/blueprint.css), as [`base.css`](src/base.css) is for the default), and [`src/skins.test.ts`](src/skins.test.ts) fails when a folder lacks a sheet for a skin. They style what the markup says each piece is: an `itemprop`, an element, a role. A skin also decides the layout, folder by folder: Blueprint gives the folders laid out on a grid a sheet of their own, so each label sits beside what it names. Storybook has the same switch in its toolbar.

## Storybook

`npm run storybook` shows every component folder at http://localhost:6006, and nobody writes a story. The live site carries its static build, at [storybook/](https://fernandocamargo.github.io/framework-demo/storybook/). The framework writes one file per folder ([`framework/storybook/`](framework/storybook)), and writes them again as folders and files come and go:

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

The live map draws OpenFreeMap's basemap, which needs no key. With `VITE_MAPTILER_KEY=…` in `.env.local` it draws MapTiler's instead.

| Script                                         | What it does                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                  | The dev server.                                                                                                                                                                                                                                                                                                   |
| `npm run build`, `npm run preview`             | The production build, and a server for it on port 5181.                                                                                                                                                                                                                                                           |
| `npm run typecheck`                            | Writes the component folders' declarations, runs `tsc` for the tooling, and runs the framework's checker for the app: TypeScript with the injected types, plus the convention checks.                                                                                                                             |
| `npm test`                                     | The unit tests: pure functions, flows, services on the memory client, the API client, and the framework's runtime.                                                                                                                                                                                                |
| `npm run lint`, `npm run format`               | ESLint orders the code: imports in three groups (packages, `framework` and `@/…`, relative), a blank line between them, and keys, props, destructuring and types alphabetically, except where order means something (`eslint.config.mjs`). Prettier lays it out (`.prettierrc`, as in Cape). `format` fixes both. |
| `npm run check`                                | `lint`, Prettier's check, `typecheck`, `test` and `build`.                                                                                                                                                                                                                                                        |
| `npm run e2e`                                  | Builds, serves, and drives the main flows in Chromium (and WebKit in CI). Run `npx playwright install chromium` once.                                                                                                                                                                                             |
| `npm run perf`                                 | Builds with React's profiling build and counts the renders of each step of a flow ([`perf/`](perf/README.md)).                                                                                                                                                                                                    |
| `npm run perf:frames`                          | The same steps, measured in frames: long animation frames, forced style and layout, and the slowest interaction of each step.                                                                                                                                                                                     |
| `npm run doctor`                               | react-doctor's static scan, one pinned version through npx with its telemetry off; `npm run doctor runtime` runs its runtime scan over the visit.                                                                                                                                                                 |
| `npm run storybook`, `npm run build-storybook` | Storybook, on port 6006, and its static build in `storybook-static/`. `npm run stories` writes the story files alone; `typecheck` runs it and checks them.                                                                                                                                                        |

In VS Code, `.vscode/` sorts and formats a file on save (with the ESLint and Prettier extensions it recommends), and offers the workspace's TypeScript, so that the language-service plugin in `tsconfig.json` loads. See [the framework's README](framework/README.md#editors).

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

| Ecosystem | Read and rewrite                 | Teach the editor                                                    |
| --------- | -------------------------------- | ------------------------------------------------------------------- |
| C#        | Roslyn source generators         | Roslyn analyzers, which run in the IDE and in the build             |
| Kotlin    | KSP processors, compiler plugins | The same compiler plugins, in the IDE                               |
| Rust      | Procedural macros                | rust-analyzer expands them                                          |
| Swift     | Swift macros                     | SourceKit expands them                                              |
| Python    | `ast`, import hooks              | A type-checker plugin (mypy), or stubs generated beside the sources |

The mechanism differs. The idea carries: give each kind of decision one place, type the seams between the places, and let the build do the wiring.

## What is not here

- The `Route` and the hash router in [`src/main.tsx`](src/main.tsx) stand in for a routing layer: the hash's path names a page, and its query the rest. `form.ts` stands in for a form manager.
- The live map is the app's one imperative widget, a React ref callback in `src/widgets/`, outside the component folders. Where such widgets belong is open.
- Services receive no `AbortSignal` from the data layer yet. The client honours one; a stale answer is ignored by its cache key instead.
- The local overlay keeps the API's paging, so a page that lost a product is one short.
- The live site's build has no GrowthBook key, so its flags come from memory, and the live map is off until the lab turns it on.
- Offline use, and where the session and other stored data live, are not designed yet.
- The framework is a working sketch, not a library.

## Layout

```
framework/          The framework: plugin/, runtime/, typescript/, shared/, storybook/, microdata/. See its README.
src/
  main.tsx          The shell: which world and locale, the router's stand-in, Root, failures as toasts.
  locales.ts        The locales the app speaks, and `?lang=` in the address.
  env.d.ts          What this app injects: Env, Route, Flags, Navigation.
  address.ts        The address, as the route and back: the page in the hash's path, the rest in its query.
  format.ts         How values read across components: the currency, what counts as low stock, availability.
  reads.ts          What Root reads for the app: who is signed in, what they may do, their flags.
  base.css          Design tokens and the look of the controls, for the default skin.
  broadsheet.css    The same, for the Broadsheet skin.
  blueprint.css     The same, for the Blueprint skin.
  skins.ts          The skins, and `?skin=` in the address.
  clients/          Transports.
  services/         Operations, and what makes what stale.
  components/       Component folders.
  widgets/          Imperative widgets, outside the folders: the live map.
e2e/                The end-to-end flows.
perf/               Render cycles, step by step, against a baseline.
.storybook/         Which folders Storybook shows, and the stage its stories render on.
.vscode/            Sorting and formatting on save, and the workspace's TypeScript.
eslint.config.mjs   What is sorted, and what keeps its order.
```
