# The rendering walk

A visit should cost its mounts, then one render for each component whose output changes at each interaction. Nothing should render to show the same thing, and nothing should be thrown away. Opening a page should approach a sheet already filled with its data. This is a target for the whole tree, including the shell and the controls, not just the framework's render functions.

The demo mounts with `createRoot`; these visits do not measure server rendering or hydration. The target describes how little work a visit should need. Loading, focus, validation, progress and accessible announcements still have to work. An interaction that deliberately shows several successive results has several output changes; collapsing those results is not a saving.

## Read the counts

Use [the history](README.md), [the driver](cycles.mjs), [its instrumentation](vite.config.ts) and [the recorder](recorder.js) together.

| Count                           | What it says                                                                                                                                                                  | What it does not say                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calls`                         | Calls of a folder's plain render function, through `useShow`.                                                                                                                 | All React executions. A wrapper can execute and return an existing element without calling the render.                                                                                       |
| `thrown`                        | Those calls whose output no commit eventually used. Reused attempted output is kept.                                                                                          | All abandoned React work. Suspended attempts and the shell's and dependencies' abandoned renders are not counted here.                                                                       |
| `fw new / again / no-change`    | Committed `StatefulView` and `StatelessView` executions: mounts, updates, and updates with no attributed DOM change.                                                          | Calls of `render.tsx`, unique instances, or the number of DOM mutations.                                                                                                                     |
| `plumbing`                      | The folder-named `Component` and `View` wrappers, counted separately.                                                                                                         | Root or every provider. React Aria also has a function called `Component`; its bare name belongs in `other`.                                                                                 |
| `other new / again / no-change` | All other recorded components: Root, Shell, providers, controls and their leaves.                                                                                             | Only React Aria. Report the enclosing folder and actual function as well.                                                                                                                    |
| `dom`                           | Changed text or attributes, additions or removals in the component's subtree, including portals. Writing the old attribute value again is no change.                          | A complete description of useful work. Focus, input properties, internal collection state and event semantics are not all DOM mutations. Ancestors can get credit for a descendant's change. |
| `why`                           | Changed props; changed hook slots or context identities when props are identical; otherwise the parent. `≈` means the recorder's approximate value comparison found equality. | A proof that a function's closure is equivalent, an identification of a hook's meaning, or a causal stack. Its function comparison uses source text; contexts often have no names.           |
| `ms / wasted`                   | Instrumented committed render time, and its no-change part.                                                                                                                   | Wall time, total browser work, abandoned render time, or a production latency budget.                                                                                                        |
| `miss / errors`                 | A step failed its immediate check after `idle()`, or a page error occurred.                                                                                                   | Permission to discard an inconvenient count and keep sampling silently. Keep the failure and investigate it.                                                                                 |

Never add `calls` to committed renders, or `no-change` to `again`; they overlap. Never call 12 row instances 12 renders of one instance. `DETAIL=1` prints only no-change groups, eight per step by default. Use `TOP=1000` or read `cycles.json` for the rest.

`cycles.json` contains the first run only. `runs.json` has every run's **main or features** totals and, under `further`, the further steps' totals and misses (`perf/totals.mjs`). Printed `further:` is the first run; printed idle times are medians when `RUNS>1`. Repeat separate `RUNS=1` labels when comparing individual steps or modes.

`node perf/walk.mjs perf/out/<label>/cycles.json` reads that same trace and prints JSON with all steps, all cause groups, calls and suspends by folder, owner totals, and separate main/further/features totals. It leaves events outside step labels visible. `withoutOwner` means no view of that folder name executed in that commit; it is co-occurrence, not proof of independence, and not an instance-level selector. Its `--self-check` exercises the partition, reused calls, mounts, further failures and unassigned work.

## The cycle

1. Record the revision, dirty files, platform, installed versions, engines, viewport and workload. Read this playbook first. Reproduce a known symptom with its entry's confirmation; do not reopen the whole investigation for an already understood cause.
2. Walk from Root to leaves in the order below. Keep the current component's parent, siblings and children in view. For each interaction, write the expected changed area before examining the count.
3. Mark anything weird: a no-change update; a thrown call; repeated work by one instance in one interaction; work outside the touched area; a mount replacing an existing control; or different counts across runs or engines. Repeated useful progress, locale changes and distinct keyed rows need explanations too, not automatic fixes.
4. Match the symptom **and cause** to an entry. A familiar-looking counter with a different producer is a new investigation. Trace the changed value from its producer to the first consumer whose output did not change. Separate dependency state, props, contexts, the chart, reads and scheduling. Use a small failing behavior/count test when possible.
5. For a new pattern, record the cause, its evidence, the smallest correction and its acceptance test here before handing off a fix. A hypothesis stays labelled as one. If the cause is not proved, investigation continues; the executor is not asked to guess.
6. Dispatch one bounded item. The reviewer compares the same steps before and after, reads connected callers, checks behavior and counts, and either accepts it or returns a concrete failure. Only the reviewer commits an accepted change, unless the working brief forbids commits. Update the entry with the commit and measured saving. Do not count the same saving against two entries.
7. Put owner choices in a decision list and continue with unblocked work. Start the next cycle from the updated entries and the next unexamined branch, not from a new global audit.

## Walk from the top

| Level               | What to inspect and count                                                                                                                                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root and providers  | Root, QueryClientProvider, locale, route fields, FrameworkContext and their values. Which value changed? How many commits preceded the page? Track cold reads, language changes, pending transitions and entity selection separately. Context provider fibers are not component executions in this recorder.                                       |
| Shell               | `src/main.tsx`: Shell, both I18nProvider functions, failures, gallery routing. Count urgent and transition commits, and distinguish a changed child from a new equal child element. A provider with no DOM can still deliver a required context change.                                                                                            |
| App and header      | `components/app`, session, lab, language, skin, tour, palette, keyboard. Check authentication arriving through separate reads/chart state; closed panels; locale fan-out; work while another page changes.                                                                                                                                         |
| Each page           | Catalogue, report, orders and states. Compare route/read keys with the fields the page uses. Distinguish a new page's mounts from updates to its old instance. Check error and placeholder boundaries.                                                                                                                                             |
| Each child folder   | Catalogue filters → rows → delete links; product modal → detail → reviews, editor and removal; bulk wizard; orders → regions, ledger and detail; palette → commands; lab → flags and sell-out; keyboard → list. Read the folder's layers, callers and tests before prescribing a change. Count data/prop changes, mounts and updates at each edge. |
| React Aria's leaves | Within each folder, follow Select → Popover → collection → items, dialog → fields, Tabs → panels, Slider → label/output/thumb, Autocomplete → menu. Inspect `own`, `parent` and `props` groups in commits with and without their owning folder. Resolve hashed symbols in the installed package, not by their name alone.                          |

The two visits cover 26 of the 29 folder types in the top document at Q-382. The keyboard list, lab flags panel and product removal dialog are not mounted. Serving flags programmatically does not measure the flags chooser. Gallery iframes and MapLibre's drawing are not included in top-document totals. Add separate authorized coverage for those branches; absence from the trace is not zero cost.

### Tools and repeatability

Use the installed Node, React profiling build, Playwright, Vitest, Testing Library, ESLint and hooks rules. No extra package is needed for this walk.

```sh
export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"
export CHROMIUM=$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium_headless_shell-1243/*/chrome-headless-shell)
export WEBKIT="$HOME/Library/Caches/ms-playwright/webkit-2359/pw_run.sh"
export PORT=5312
npx --no-install vite build --config perf/vite.config.ts --logLevel warn
ENGINE=chromium VISIT=main RUNS=1 DETAIL=1 TOP=1000 LABEL=q382/c-main-1 node perf/cycles.mjs
ENGINE=webkit VISIT=main RUNS=1 DETAIL=1 TOP=1000 LABEL=q382/w-main-1 node perf/cycles.mjs
ENGINE=chromium VISIT=features RUNS=1 DETAIL=1 TOP=1000 LABEL=q382/c-features-1 node perf/cycles.mjs
ENGINE=webkit VISIT=features RUNS=1 DETAIL=1 TOP=1000 LABEL=q382/w-features-1 node perf/cycles.mjs
node perf/walk.mjs perf/out/q382/c-main-1/cycles.json > perf/out/q382/c-main-1/walk.json
node perf/walk.mjs --self-check
PORT=5312 node perf/gate.mjs --no-build
```

Use the work item's assigned ports and unique labels. Run browser measurements serially. The cycle driver serves its own build and blocks remote requests; the map gets an empty style. Do not add sleeps or alter the driver to make a change pass. Its existing lab/palette timer observations and final drain are part of this workload. They are not application synchronization APIs. Wait on `window.__framework.idle()` for framework work, as the existing flows do.

Collect at least three separate clean samples of each relevant visit/engine before and after; for other/thrown differences use at least five alternating samples of the two builds. Extend sampling when modes overlap. Show every result, failures and mode frequencies. Never compare a minimum selected from one mode with a typical result from another. Supplied measurements are usable evidence when browsers cannot launch, but they cannot validate an unmeasured patch.

React's built-in `Profiler` needs no dependency. In a scratch harness, wrap the suspected boundary and its child separately, recording `id`, phase, `actualDuration`, `baseDuration`, `startTime` and `commitTime` through `onRender`. Correlate commits with `cycles.json`. It measures committed work and cannot replace the discarded-call counter. If React DevTools is already available, use its Profiler flamegraph/ranked view and “why did this render”; do not install an extension as an implicit task dependency. A Profiler callback alone does not explain a cause.

Use `perf/frames.mjs` for untraced Chromium frame/interaction checks, and `TRACE=1` for layout stacks only after count attribution. Trace times are not comparable to untraced times. Its stock visit excludes further steps. This WebKit executable has no Long Animation Frame observer; “none reported” is unsupported, not zero. Use the recorded capability and supported timing metrics if extending the harness.

`perf/doctor.mjs` pins react-doctor 0.9.23 but invokes npx with downloads allowed. Do not run it under an offline brief unless the exact package is already available and execution cannot fetch. Its runtime tracing has known overhead in the history. No react-scan, Compiler or other new dependency is proposed by this pass. A later proposal must name an exact version, the missing evidence it would obtain, its overhead, and the owner decision; no floating version and no installation by an executor.

## Entries

Numbers in historical entries belong to the stated round, not today's baseline. C/W means Chromium/WebKit. “Again (unchanged)” always counts committed executions. Entries with a pending decision or incomplete proof are not executable fix recipes yet.

### 1. A misleading count

- **Symptom:** repeated input `name`/`type` writes look useful; a disappearing delete link looks unchanged; React Aria's `Component` is classified as framework plumbing. The third round's correction changed other unchanged counts from 1,903 to 2,228 on the same code.
- **Confirm:** inspect mutations and the fiber's actual type, name and deletion flags in `recorder.js`. Check aggregate sums against individual commits. Input properties and focus require behavior checks too.
- **Cause:** the recorder confused writes with changed values, removal with no child, and equal function names with equal owners.
- **Correction:** compare original and final values, attribute deletions, distinguish folder-named wrappers. Keep the same definition before and after a product fix. A recorder repair is a separate measurement change with its own comparison.
- **Guard / applied:** `recorder.js`, `cycles.mjs`, `walk.mjs --self-check`; “After the third round” and the flags round in README. No counter definition changes in Q-382.

### 2. A folder follows a source it never uses

- **Symptom:** the filter bar renders at a keyboard registry, person or route change. The shortcuts round initially counted 258 framework updates, 79 unchanged; narrowing reads brought them to 202 (28).
- **Confirm:** compare `readsOf` output with the functions the framework actually invokes. A helper with a plain parameter must not mean “reads every injection”.
- **Cause:** every exported helper in `props.ts` was analysed as an injected entry point.
- **Fix:** analyse only the layer's called exports, and conservatively report genuinely unknown reads. Do not special-case a folder name.
- **Guard / applied:** shared folder convention tests and `hooks.test.tsx`; shortcuts round, `f99f14f`. Member-level subscription redesign remains entry 21, R-07.

### 3. The whole address reaches a narrow consumer

- **Symptom:** opening a product renders the catalogue; changing a page renders the filter bar; opening an order renders the ledger. Route fields reduced framework updates from 267 (28) to 248 (9); the later features round reduced 82 (7) to 78 (3).
- **Confirm:** inspect route spreads, default-read keys and the actual props given to the child. Use a field outside its domain and assert zero updates there.
- **Cause:** whole-route subscriptions or a broad filters object carried unrelated changes. Chart initialization also kept following the whole route after it was needed.
- **Fix:** use the existing field subscriptions and pass only fields the view needs. Build links from the page's own state. Do not change the address contract or invent a router.
- **Guard / applied:** `route.test.tsx`; filter paging and order-open steps. README “After route fields”, third and fourth rounds. New routing/read semantics need the owner, R-07/R-14.

### 4. A closed parent owns a live child read

- **Symptom:** the closed lab rendered when the editor opened and closed, two of seven unchanged framework updates.
- **Confirm:** the read uses `route.edit`, but only the sell-out button displays its answer.
- **Cause:** the parent subscribed on behalf of a child it did not show.
- **Fix:** move that read into the existing child boundary; mount it where the UI needs it. Keep the same DOM and keys. A similar split must preserve polling, cached state and first-show behavior; do not assume every hidden consumer can be moved for free.
- **Guard / applied:** lab sell-out folder, route tests, zero lab updates on editor open/close; README “After the third round's follow-ups”. Hidden activity tabs are a distinct residual, entry 19.

### 5. Equal data and elements acquire new identities

- **Symptom:** unchanged rows or controls render after their parent, with `props …≈`. Shared elements reduced sign-in's other updates from 158 to 86 and sign-out's from 69 to 17 in the keystroke round.
- **Confirm:** locate the first changed prop, compare its actual values and keyed item identity, then check the existing answer/shaped-prop/output sharing path. A function with identical source may capture different values.
- **Cause:** equal parts were reconstructed at the producer or a parent returned fresh subtrees. The existing framework shares both inputs and output, including keyed elements.
- **Fix:** use the existing boundary and preserve unchanged values at their producer. Do not add a second memo/cache, change a key, or remove a dependency to conceal churn. Replacing the render cache is an owner decision.
- **Guard / applied:** `elements.test.tsx`, `discarded.test.tsx`, row reorder and optimistic tests; `c189758`, third round. R-13 is paused, not permission to redo this optimization.

### 6. Event identity is maintained by a second runtime

- **Symptom:** handlers keep functions stable through a mutable call-order registry; Q-367 measured an old closure during a child's layout effect. Five legacy JSX sites remain. There is no established render-count saving from migrating them.
- **Confirm:** inspect generated modules: a `handlers.<name>` attribute is direct; other handler attributes still go through `track`. Follow every caller, keyed row, telemetry site and failure path.
- **Cause:** legacy wrappers stage closures and publish them after commit. Their lifetime and call order duplicate React's callback ownership.
- **Fix:** use the already-approved generated hook: one callback per export, reconstructed arguments and real member dependencies. No ref or latest-value holder. Migrate one folder/site family at a time. A dynamic collection command or passthrough policy that needs a new handler shape goes to the owner first.
- **Guard / applied:** `handlers.test.tsx`, `handlers-module.test.ts`, convention tests; the generated hooks of five fixtures and every app `handlers.ts` are linted with the installed hooks rules, and a module missing one dependency must be reported (R-01, done). Generated wiring exists; R-06's row, flags and palette sites remain. Delete registry machinery only after every caller is migrated, including placeholder/error handling; keep telemetry exactly once.

### 7. A non-event JSX function changes identity

- **Symptom:** a collection gets a new children function on every render. Hoisting reduced search's other updates from 96 (54) to 56 (14), and clearing from 175 (102) to 104 (31).
- **Confirm:** inspect the plugin's transformed function and its free variables. An eager `.map` callback is not itself a prop needing stable identity.
- **Cause:** constant collection callbacks were recreated in the render; captured callbacks can also change without their captured values changing.
- **Fix:** retain existing static hoisting for truly constant functions. Captured values must be actual dependencies; the existing `keep` is historical machinery, not a pattern to expand. Its replacement needs the owner under R-13.
- **Guard / applied:** `constant-functions.test.ts`, collection ordering and locale changes; third round and follow-ups. Today's filter callbacks are already hoisted; two slider formatters still use `keep`.

### 8. A field's value remounts it or updates its whole form

- **Symptom:** six title keys formerly cost six framework and 602 other updates (366 unchanged); now zero framework and 50 (18), in both engines. Search formerly remounted seven React Aria pieces and lost focus. A slider keyed by its setting lost keyboard focus.
- **Confirm:** check `key`, value/defaultValue ownership, seed dependencies, selection and DOM node identity after keys and back/forward navigation.
- **Cause:** form-wide value subscriptions or a data-dependent key made unrelated fields update or replaced a control.
- **Fix:** keep the established field/form boundary, real stable keys and prop-following search seed. Do not freeze a `defaultValue` to hide a prop update; reopening, reset and outside changes must still work. Changing the form contract goes to the owner.
- **Guard / applied:** component/form behavior tests and the typing/search/slider flows; `c189758`, slider follow-up, `eb43236`. R-10 is a contract decision, not a measured saving.

### 9. A chart publishes a movement with no new view

- **Symptom:** the open lab formerly made four render calls and 130 other updates (120 unchanged) in two seconds. Today the supplied observation is one useful lab update and 26 (16) other updates, in both engines.
- **Confirm:** compare state value, context, status/error and at-rest status, not snapshot object identity alone. Attribute any new activity or clock value separately.
- **Cause:** reentry/invoke bookkeeping produced fresh snapshots and equal context fragments.
- **Fix:** keep `sameShown` and context sharing. Filter a genuinely equal snapshot at its source; never discard progress results, delay updates, or redefine guard visibility.
- **Guard / applied:** `state-renders.test.tsx`, chart tests, idle and progress steps; third round. R-12's source and guard semantics remain an owner decision.

### 10. A confirmation differs from its optimistic prediction only in bookkeeping

- **Symptom:** the saved row renders at send and again at confirmation for its version alone.
- **Confirm:** compare optimistic and confirmed product/version values; test concurrent writes and rollback as well as success.
- **Cause:** the optimistic projection did not predict the server's version increment.
- **Fix:** correct the projection once, using the actual domain rule. Do not ignore version or error changes in an equality comparator.
- **Guard / applied:** `optimistic.test.ts`, product overlay tests; `68f7366`. Today's rows have zero unchanged updates in both visits; no saving is queued here.

### 11. Operation status replaces the command

- **Symptom:** changing one lab setting used to change every operation function and dependent control handler. `7429377` records further-step unchanged other renders falling 746→266 C, 737→257 W; calls 98→94 in both.
- **Confirm:** hold the operation and a handler that invokes it through pending, success, failure and a second operation's update. Distinguish status from changes of module or injection.
- **Cause:** every `run` was created inside a memo depending on all operation states.
- **Fix:** the decided API is a callable operation carrying its own state, keeping its identity while its sources stay the same. Status must still reach files that read it. Use the implementation at `7429377`; do not substitute `{ run, … }` from the superseded backlog recommendation. New lifecycle work must not add holders.
- **Guard / applied:** async identity/source/overlap/error/unmount tests, handler identity plus visible pending test, both slider steps in both engines; `7429377`, R-04 complete. Cancellation ownership R-09 is separate and has no additional count budget.

### 12. A layer hook runs although the folder has no layer

- **Symptom:** Q-378 counted 375 empty form and 249 empty operation hook executions in its main trace. These are work inside renders, not 624 avoidable component renders.
- **Confirm:** a no-layer, empty-async and default-read-only folder on mount and update must call neither absent hook.
- **Cause:** `useLayers` called both hooks for every folder, creating unused stores, effects and subscriptions.
- **Fix:** choose the real hook or frozen empty result once per loaded type, and include hook shape in HMR's remount key.
- **Guard / applied:** `hooks.test.tsx`, `hot.test.tsx`, ordinary-edit state preservation and pending-operation cleanup; `23503a1`, Q-379/R-03 complete. No render saving is attributed to it.

### 13. Progress passes through the overlay that measures the page

- **Symptom:** “apply to the nine” has 13 framework / 188 other updates (46 unchanged), C and W. Ten are useful bulk updates. The unchanged leaves include ten headings, ten DOM wrappers, ten ModalOverlay wrappers and eight close-button pairs. Q-378's Chromium trace had seven modal geometry reads / 13.4 ms here.
- **Confirm:** correlate progress commits with `Modal.mjs`'s body/scroll geometry reads. Do not equate the ten unchanged wrappers with ten measured layout reads.
- **Cause:** the wizard owns the progress and the overlay's changing children together; React Aria republishes dialog context and measures on its render.
- **Fix:** the successful product pattern keeps one overlay around its placeholder/content/error. For bulk, decide a shell that owns open/dismissal/phase and a child that owns progress, using a supported selector boundary. A generic always-dismissible Modal is insufficient. No imperative bridge.
- **Guard / applied:** product modal follow-up complete; R-05 bulk paused for the boundary decision. All nine writes/results, retry, large-change confirmation, Escape/outside click, focus and all skins must survive. Target fewer modal executions/geometry reads; 46 is an opportunity ceiling, not a promised saving.

### 14. A child read starts only after its parent can render

- **Symptom:** cold catalogue throws ten calls, fast product eight, both engines. Slow product at 500 ms latency reaches idle at about 1,080/1,079 ms and throws none. Features throw 23 calls per supplied first run.
- **Confirm:** align call/suspend/commit timestamps and query starts. Product and reviews have independent `route.view` reads, but the reviews component is discovered through the product's render. Preloaded code is not preloaded data.
- **Cause:** sequential discovery plus React's fallback retry throttle. The installed profiling reconciler uses `globalMostRecentFallbackTime + 300`; commits during that interval can cause further attempted renders.
- **Fix:** owner choice on authorized independent read preloading and first-content policy. Pilot product/reviews only after query-start evidence; retain separate error/placeholder boundaries. Never slow the data, remove the placeholder, or alter idle to lower thrown counts.
- **Guard / applied:** R-08 pending; aborted navigation, authorization/entity isolation, failed reviews and both fast/slow visits. About one 500 ms interval is a hypothesis, not measured improvement.

### 15. Authentication reaches the same view through several sources

- **Symptom:** main has five unchanged framework updates in both engines: session restoration, app/session at sign-in, app/session at sign-out. Features have three/two. Some wrapper executions reuse prior output rather than call the plain render.
- **Confirm:** inspect session's chart transition, app's session/ACL read and the `asked`/`reason` props separately. In features WebKit coalesces away the app's extra no-change update; it still has session's prop update.
- **Cause:** the session chart, user/permissions/flags reads and app-derived dialog request settle separately. The chart follows whole shown state, even when this particular view does not use its changed part.
- **Fix:** retain correctness until the owner chooses source/read/guard semantics. Narrow pure view inputs with an approved generated boundary if possible; do not batch away user-visible intermediate states or synchronize by delay.
- **Guard / applied:** R-07/R-12 pending; guest/restore/sign-in/out, other-tab and permission-during-write tests. Five is a measured bucket, not five guaranteed removable renders.

### 16. A control updates its own context and leaves

- **Symptom:** editor typing costs 18 unchanged leaves (six Label, six DOMElement, six FieldError) with zero framework updates, C/W. Sorting costs 131/132 unchanged other updates. Palette typing costs 203/203, including internal collection and context work.
- **Confirm:** follow the owning control into the installed package. `TextField.mjs` constructs label/input/validation provider values; Select and collection items publish selection/focus contexts. Check commits without the enclosing view, not just prop changes in the parent.
- **Cause:** the dependency owns state and republishes contexts/collection values; some changes are necessary for focus and accessibility, some may be identity-only fan-out. The cause of an individual leaf must be proved before classifying it as removable.
- **Fix:** a measured, behavior-preserving correction at the producer, with every context dependency retained. No blanket memo around the framework, native-control replacement, package patch or upgrade without an agreed delivery/behavior decision. No universal leaf fix is established by Q-382.
- **Guard / applied:** Q-378 and Q-382 leaf audit; R-05 overlaps modal work. Test keyboard, pointer, validation, label association, focus restoration and locale, then count the same interaction in both engines. Do not promise all 203 palette or 557 filter unchanged updates.

### 17. The shell and providers execute before the page commits

- **Symptom:** main Root and QueryClientProvider each execute again 62 times, 22/23 unchanged C/W. Features: 54 each, 23 unchanged. A product open has two unchanged executions each of Shell, two I18nProvider functions, Root and QueryClientProvider.
- **Confirm:** inspect `useTransition`, pending `navigating`, the old/new route, and freshly constructed child elements in `src/main.tsx`. Root is in `other`, not `fw`.
- **Cause:** urgent pending state and the destination transition execute the shell/provider chain; children are rebuilt while Suspense can retain the old page. A context delivery with unchanged DOM can be necessary.
- **Fix:** preserve transition and address semantics. A provider/boundary split needs a trace showing which inputs can remain unchanged; root memoization cannot erase real context delivery. Route ownership is the owner's decision, R-14. No executable reduction is established yet.
- **Guard / applied:** new investigation Q-382; pending indicator, stale page continuity, navigation supersession, locale and skin transitions. Do not subtract the entire shell bucket as waste that can be deleted.

### 18. A closing popover overlaps another step

- **Symptom:** one saved higher Chromium mode adds 167 other updates, 127 unchanged, over four steps; framework committed totals stay 254 (5). The product then throws three more calls in that saved comparison. The reported fourth call and one-in-six frequency are not verified by that trace.
- **Confirm:** inspect PopoverInner's `isExiting`/state changes and collection commits after the next phase begins. In the higher trace an option is selected about 34 ms after opening; the usual trace waits about 262 ms. The stylesheet's enter animation is 140 ms. Correlate actual animation identities/events in the next runnable probe before attributing every extra commit.
- **Cause:** the collection stays alive while exiting. Installed `useAnimation` waits for all running element animations, including a still-running entrance; completion calls `flushSync`. `idle()` intentionally does not wait for overlay exits. A later completion can also interrupt React's fallback wait (entry 14). The animation-specific explanation is a source-supported inference, not a completed browser intervention.
- **Fix:** none authorized yet. Investigate which animation is awaited and preserve both opening and closing behavior. Do not add a driver sleep, disable animation, force one mode, or change measurement boundaries. A dependency correction needs a reviewed delivery choice if one is necessary.
- **Guard / applied:** new investigation Q-382; full mode distributions and commit timelines, interrupted opening/closing in both engines and all skins. Historical raw trace `loop1-re-after` has no revision stamp; current supplied playbook traces cover the usual mode only.

### 19. Hidden tab data and a changed default reach live controls

- **Symptom:** further slow search has 10 (1) framework / 87 (43) other updates C, versus 9 (0) / 62 (18) W. The extra lab commit changes nothing. A slider step has four lab wrapper updates but two plain render calls; 38 unchanged other updates when slowing, 40 when restoring, both engines.
- **Confirm:** the lab's chart polls both activity lists; a hidden tracked panel's children change while the network panel is selected. `TabPanel` can return null while Tabs/collection state still updates. Sliders also receive a new `defaultValue` after the same control already changed its internal value; DETAIL names it explicitly.
- **Cause:** background activity changes parent-owned children for an inactive tab; the settings read echoes into an uncontrolled control's default. These are separate from the fixed operation function identity.
- **Fix:** consider an explicit subscription boundary for inactive data and a defined initialization/reset ownership for the slider. Preserve polling cadence, log freshness on tab selection, outside setting changes, reopening and focus. Moving a mutable initial value into a holder or hiding all poll updates is not a fix. No complete correction is established in this pass.
- **Guard / applied:** Q-382; entries 4/8/9 supply the established constraints, not an automatic recipe. The 25-extra-render tick moves between steps; a per-step minimum is not a gain. Owner read/form policy may be needed.

### 20. The gate omits the bucket that regressed

- **Symptom:** the operations regression and fix leave the gate green. Main 29 and features 18 steps are compared; further ten are excluded. Only framework again/unchanged can fail it.
- **Confirm:** `steps.mjs` marks `further`; `cycles.mjs` filters those out of `runs.json`; `gate.mjs` reads only that file and gates two framework keys. Other/thrown are reported minima. A further-only check failure is also absent from numeric `misses`; page errors remain global.
- **Cause:** historical comparability and timer variability led to a separate reported section; no further distribution or ceiling was established. Even gating its framework count would not protect an operation change whose saving is mainly in `other`.
- **Fix:** preserve all further measurements and failures alongside the current gate before proposing separate calibrated limits. `walk.mjs` does this for a saved first run. A future driver extension should retain every run's steps and aggregate further failures without changing actions, waits or definitions. No baseline movement in this pass.
- **Guard / applied:** `runs.json` retains each run's further counts and misses beside unchanged visit figures; `perf/totals.mjs` computes both, and `totals.test.mjs` shows that a run whose only failed check is a further step did not play the whole visit. The gate prints every run's further totals without a new threshold. Baseline/threshold decisions require real same-platform repeated evidence; the gate remains a regression check, not acceptance of the whole target.

### 21. Ref removal is mistaken for render reduction

- **Symptom:** an ownership cleanup is assigned a saving without a rendered component or workload. Entity switching is not present in these visits; form typing already costs zero framework updates.
- **Confirm:** inventory actual holders and callers on the current revision. R-02 is already resolved by `a8c780b`: Root requires its client. The old proposal to initialize a private client is obsolete. R-03/R-04 are complete too.
- **Cause:** caches, event-time sources, operation cancellation and chart/form ownership solve different problems and have different costs. Moving a ref into mutable state changes no ownership.
- **Fix:** follow Q-367's dependency order with the current prohibition on mutable holders. R-07 static reads; R-09 operation lifetime; R-10 forms; R-11 entity/client scope; R-12 guards; R-13 caches/Compiler; R-14 routing each need their own owner decision and behavior tests. Do not implement Q-367's old mutable-store suggestions under the present rules.
- **Guard / applied:** hooks lint and focused lifecycle/concurrency tests. No new ref, ref-filling effect, mutable state store, module-level per-instance state or suppression. Zero count gain until measured; no Compiler or new dependency without approval.

### 22. Every instance subscribes to the same rule's whole snapshot

- **Symptom:** signing in originally updated 17 framework components (15 unchanged), including equal delete-link decisions; deciding the shared rule once reduced this to five (three unchanged) in the ACL round.
- **Confirm:** inspect the rule's inputs. A rule reading only the shared ACL/flags snapshot is the folder's rule; a rule depending on instance props or form values is not. Check changed decisions and unchanged ones in the same test.
- **Cause:** each row observed snapshot identity when its output depended only on a boolean decision. The equivalent locale problem is subscribing a folder that reads no messages, formatter or locale.
- **Fix:** use the existing shared rule decision and selected-source hooks, without moving instance-dependent authorization to a shared cache. Preserve source-change notifications for chart guards and event-time readers.
- **Guard / applied:** `acl.test.tsx`, `flags.test.tsx`, `i18n.test.tsx`; ACL/i18n/flags rounds, `88affed`, `b9a94f8`. Current flag steps have zero other updates; new static read semantics remain R-07, not another global snapshot subscription.

### 23. A changed render prop never reaches the page

- **Symptom:** the palette's search started twice with an unchanged page; its intended `aria-busy` prop was on a Menu that did not forward it. The fourth round made those two updates observable.
- **Confirm:** inspect the actual DOM and the installed control's supported attributes, then check the intended accessible announcement. Do not assume a prop placed in JSX was delivered.
- **Cause:** a semantic state was computed correctly but handed to a component that did not expose it.
- **Fix:** historically, put the existing busy state on the owning `search` element. This is a behavior/markup correction, not removal of render work. Under a brief requiring identical markup, report a newly found case and pause instead of moving the attribute to improve the count.
- **Guard / applied:** palette pending behavior and immediate post-idle checks; README fourth round. Current commands pending/results updates change the page. Do not count this old correction as a remaining speed gain.

## One item for an executor

The reviewer fills this in with a concrete, already investigated cause. An owner-blocked row is not a work order. Work on one item only; leave unrelated improvements in the queue.

```text
Item and playbook entry:
Revision, branch, allowed paths and ports:
Owner decisions already made (quote the relevant contract):
Symptom: visit, step, component/instance, why, C/W calls/mounts/again/unchanged/thrown:
Evidence files and exact steps/commit timestamps:
Root cause, and how to confirm it without changing the measurement:
Smallest correction; existing helper/generated boundary to reuse:
Scope: producers, every caller, layers, exports, fixtures, tests, configuration:
Behavior/markup/styles/accessibility that must remain identical:
Expected gain: measured saving or explicit target/upper bound, never a guess presented as fact:
Required regression test and before/after samples:
Checks and commands; baseline changes allowed? (normally no):
Stop conditions specific to this item:
Hand back: diff, cause, test failure before/pass after, all C/W samples, misses/errors,
unexpected mounts/calls, limitations, remaining decisions, and entry update. Leave uncommitted.
```

Stop and return the item if the cause differs, the smallest fix needs an undecided API, behavior/markup/styles change, a new dependency, a new cache or a prohibited holder; if a check would have to be weakened; if a regression cannot be explained; or if the evidence cannot distinguish a saving from another mode. Do the independent authorized checks first. A browser launch failure is reported as such, never as a passing visit. Do not suppress warnings, optimize a named measured flow, freeze data, hide a result or depend on timing.

The reviewer independently checks the dependency lists and connected code, runs `npm run check`, the relevant production E2E flows on the assigned preview port, both cycle visits and the gate, and compares the complete totals plus the target steps. Run `npx oxfmt` on changed files. Refuse a reduction that costs focus, cancellation, permissions, data correctness, progress, or an unreported increase elsewhere. Do not change the baseline merely to pass; a deliberate budget change goes to the owner with evidence. Bring the owner two or three options and a recommendation for each paused contract. Record accepted commits and counts here so the next pass begins with what is already known.
