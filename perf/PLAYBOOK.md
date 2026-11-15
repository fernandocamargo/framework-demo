# The rendering walk

A visit should cost its mounts, then one render for each component whose output changes at each interaction. Nothing should render to show the same thing, and nothing should be thrown away. Opening a page should approach a sheet already filled with its data. This is a target for the whole tree, including the shell and the controls, not just the framework's render functions.

The demo mounts with `createRoot`; these visits do not measure server rendering or hydration. The target describes how little work a visit should need. Loading, focus, validation, progress and accessible announcements still have to work. An interaction that deliberately shows several successive results has several output changes; collapsing those results is not a saving.

## Read the counts

Use [the history](README.md), [the driver](cycles.mjs), [its instrumentation](vite.config.ts) and [the recorder](recorder.js) together.

| Count                           | What it says                                                                                                                                                                  | What it does not say                                                                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calls`                         | Calls of a folder's plain render function, through `useShow`.                                                                                                                 | All React executions. A wrapper can execute and return an existing element without calling the render.                                                                                             |
| `thrown`                        | Those calls whose output no commit eventually used. Reused attempted output is kept.                                                                                          | All abandoned React work. Both counters sit after the render cache: a retry can rerun hooks, shaping and comparisons, return cached output, and add neither a call nor a thrown call.              |
| `fw new / again / no-change`    | Committed `StatefulView` and `StatelessView` executions: mounts, updates, and updates with no attributed DOM change.                                                          | Calls of `render.tsx`, unique instances, or own-output changes. `no-change` is a lower-bound view of same-output work: ancestor credit hides it; see the attribution limits below.                 |
| `plumbing`                      | The folder-named `Component` and `View` wrappers, counted separately.                                                                                                         | Root or every provider. React Aria also has a function called `Component`; its bare name belongs in `other`.                                                                                       |
| `other new / again / no-change` | All other recorded components: Root, Shell, providers, controls and their leaves.                                                                                             | Only React Aria, or all same-output work. The same lower-bound and passive-effect attribution limits apply. Report the enclosing folder and actual function.                                       |
| `dom`                           | Changed text or attributes, additions or removals in the component's subtree, including portals. Writing the old attribute value again is no change.                          | Own output, paint, or usefulness. Every ancestor gets credit for a descendant's mutation. Passive-effect and other between-commit writes are taken at the next commit, not their producing commit. |
| `why`                           | Changed props; changed hook slots or context identities when props are identical; otherwise the parent. `≈` means the recorder's approximate value comparison found equality. | A proof that a function's closure is equivalent, an identification of a hook's meaning, or a causal stack. Its function comparison uses source text; contexts often have no names.                 |
| `commits / first content`       | Every recorded commit, including empty component lists; commits before the identified page and its first content commit time.                                                 | Paint or interaction latency without an action-start/paint marker. Saved cold first-content times are commit proxies, not FCP.                                                                     |
| `ms / wasted`                   | Instrumented committed render time, and its no-change part.                                                                                                                   | Wall time, total browser work, abandoned render time, or a production latency budget.                                                                                                              |
| `miss / errors`                 | A step failed its immediate check after `idle()`, or a page error occurred.                                                                                                   | Permission to discard an inconvenient count and keep sampling silently. Keep the failure and investigate it.                                                                                       |

The lower-bound reading is about hidden same-output work: ancestor credit can make a redundant render look changed. It is **not a mathematical lower bound on removable renders**. A passive effect runs after this recorder's callback; its write can make its producing commit look unchanged and the next one changed. Focus, input properties and internal control state add other false interpretations. A zero unchanged count does not prove useful work, and a nonzero count does not authorize deletion. Keep the historical counter and add a separately validated own-output/attempt measure if needed; do not replace it inside a product fix.

Classification is by function name. Moving work into plumbing, a differently named function, an effect or a direct DOM write is no saving. Report all three component buckets and attempts together.

Never add `calls` to committed renders, or `no-change` to `again`; they overlap. Never call 12 row instances 12 renders of one instance. `DETAIL=1` prints only no-change groups, eight per step by default. Use `TOP=1000` or read `cycles.json` for the rest.

`cycles.json` contains the first run only. `runs.json` has every run's **main or features** totals and, under `further`, the further steps' totals and misses (`perf/totals.mjs`). Printed `further:` is the first run; printed idle times are medians when `RUNS>1`. Repeat separate `RUNS=1` labels when comparing individual steps or modes.

`node perf/walk.mjs perf/out/<label>/cycles.json` reads that same trace and prints JSON with all steps, all cause groups, calls and suspends by folder, owner totals, and separate main/further/features totals. It leaves events outside step labels visible. `withoutOwner` means no view of that folder name executed in that commit; it is co-occurrence, not proof of independence, and not an instance-level selector. Its `--self-check` exercises the partition, reused calls, mounts, further failures and unassigned work.

## The cycle

1. Record the revision, dirty files, platform, installed versions, engines, viewport and workload. Read this playbook first. Reproduce a known symptom with its entry's confirmation; do not reopen the whole investigation for an already understood cause.
2. Walk from Root to leaves in the order below. Keep the current component's parent, siblings and children in view. For each interaction, write the expected changed area before examining the count.
3. Mark anything weird: a no-change update; a thrown call; repeated work by one instance in one interaction; work outside the touched area; a mount replacing an existing control; or different counts across runs or engines. Repeated useful progress, locale changes and distinct keyed rows need explanations too, not automatic fixes.
4. Use the signature index below, then match the symptom **and cause** to an entry. A familiar-looking counter with a different producer is a new investigation. Trace the changed value from its producer to the first consumer whose output did not change. Separate dependency state, props, contexts, the chart, reads and scheduling. Decode every cited `own hooks n` into the primitive, enclosing custom hook and installed source line; record the package version and verify the slot order. A memo/callback slot changing is not a state update. Include a browser-free behavior/render-count test when it can represent the cause; otherwise name the exact browser-only evidence needed and who will run it.
5. For a new pattern, record the cause, its evidence, the smallest correction and its acceptance test here before handing off a fix. A hypothesis stays labelled as one. If the cause is not proved, investigation continues; the executor is not asked to guess.
6. A second reader checks the cause against source and the per-step trace before dispatch. Dispatch one bounded item. The reviewer compares the same steps before and after, every bucket from the same run, reads connected callers, checks behavior and counts, and either accepts it or returns a concrete failure. Only the reviewer commits an accepted change, unless the working brief forbids commits. Update the entry with the commit and measured saving. Do not count the same saving against two entries.
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

The **per-step comparison is primary evidence**; visit totals are a checksum and a search for displacement into other steps. Keep each run intact. A fingerprint is the ordered vector of each step's name, completed calls, thrown calls, suspends, commits, and mounts/updates/unchanged for framework, plumbing and other. Preserve the counts behind any hash. Annotate changed components, causes and opening/closing event order to distinguish causes that happen to have equal counts. Never select different metrics from different runs.

Identify popover and cold-start modes independently by their step sub-vectors. Also retain neighboring steps: a clock tick or exit completion can move between them. `loop1-after-chromium-main` has the same other total as the supplied Chromium main but 21 cold thrown calls instead of ten; totals cannot identify a mode. `loop1-d-after` has eleven. Label traces by their fingerprint, revision, run ordinal and cold/warm state, not “usual” or “rare”. Mixed revisions and later warm runs cannot estimate the current frequency. Several matching repeats test a stable step; five samples do not establish a tail frequency. Extend evidence until the claimed step difference is separated from the observed variation, or leave the gain unresolved.

Keep the original visit as the regression workload. Separate mechanism probes should deliberately exercise both a choice during entrance and a choice after completion, using event/animation evidence rather than sleeps. Controlling an independent variable is useful; silently replacing the original workload with the cheaper case is not. Deterministic clock/animation scenarios and new gate fingerprints are proposals with their own measurement comparison. Supplied measurements cannot validate an unmeasured patch.

Alongside counts report first-content time and commits before that page. For saved traces use the first commit that mounts the identified page as an explicit **commit-time proxy**, with the prior commit count and total step commits; it is not paint/FCP. Cold Chromium catalogue: 44 calls, ten thrown, first page commit 348.5 ms after navigation, one commit before it, four in the step; WebKit: 44/ten, 369 ms, one/four. Kept plain calls finish much earlier. For subsequent interactions record the action-start marker and define the content landmark; saved phase labels alone do not supply an exact start time. Measure first product and first reviews separately from `idle()` in a read-start investigation.

React's built-in `Profiler` needs no dependency. In a scratch harness, wrap the suspected boundary and its child separately, recording `id`, phase, `actualDuration`, `baseDuration`, `startTime` and `commitTime` through `onRender`. Correlate commits with `cycles.json`. It measures committed work and cannot replace the discarded-call counter. If React DevTools is already available, use its Profiler flamegraph/ranked view and “why did this render”; do not install an extension as an implicit task dependency. A Profiler callback alone does not explain a cause.

Use `perf/frames.mjs` for untraced Chromium frame/interaction checks, and `TRACE=1` for layout stacks only after count attribution. Trace times are not comparable to untraced times. Its stock visit excludes further steps. This WebKit executable has no Long Animation Frame observer; “none reported” is unsupported, not zero. Use the recorded capability and supported timing metrics if extending the harness.

`perf/doctor.mjs` pins react-doctor 0.9.23 but invokes npx with downloads allowed. Do not run it under an offline brief unless the exact package is already available and execution cannot fetch. Its runtime tracing has known overhead in the history. No react-scan, Compiler or other new dependency is proposed by this pass. A later proposal must name an exact version, the missing evidence it would obtain, its overhead, and the owner decision; no floating version and no installation by an executor.

## Signature index

A signature is a starting point, not a diagnosis. Follow its producer and check the cause before applying a fix.

| Recorder signature                                                        | Entry / confirmation                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `own contexts Route/Locale` or source hooks; an unrelated field changed   | 2: subscription wider than the read (includes former 3, 4, 22). Decode the hook first.           |
| `props …≈`, `children≈`, collection callback identity                     | 5: equal values rebuilt (includes former 7); 6 for event publication; 11 for mutable operations. |
| `own hooks` in a chart, no new shown state                                | 9; distinguish a clock, progress or hidden list (19).                                            |
| `own contexts` in SelectValue/items, `Provider values≈`                   | 16: whole control state/props fan-out; 18 if the collection remains during exit.                 |
| Locale contexts update, then framework `Locale` arrives in a later commit | 24: two locale publications.                                                                     |
| Shell transition slots; Root `children≈`                                  | 17. Its dispatched correction is maintained with the shell change.                               |
| Parent-driven overlay during progress                                     | 13, separated from focus/geometry lifecycle in 16/18.                                            |
| Extra mounts at typing/value changes                                      | 8: keys and form ownership; preserve reset/focus.                                                |
| Auth own-source update followed by `asked` props                          | 15; distinguish converging sources from their UI policy.                                         |
| Calls discarded with equal final commits                                  | 14: read/skin/retry timeline; count work before the render cache too.                            |
| Counts change without a source/consumer explanation                       | 1: measurement; 20: gate/fingerprint coverage.                                                   |

## Entries

Numbers in historical entries belong to the stated round, not today's baseline. C/W means Chromium/WebKit. “Again (unchanged)” always counts committed executions. Entries with a pending decision or incomplete proof are not executable fix recipes yet. Entry 17 is reserved for the dispatched shell correction; its earlier “no executable reduction” conclusion is superseded by review F1, pending that update. Numbers remain stable for existing reports: 3/4/22 redirect to 2, and 7 redirects to 5. Entries 1/12/20/23 are measurement or correctness guards; 21 is ownership policy, not a render-cause recipe. Applied history has not been freshly rerun merely by being listed here.

### 1. A misleading count

- **Symptom:** repeated input `name`/`type` writes look useful; a disappearing delete link looks unchanged; React Aria's `Component` is classified as framework plumbing. The third round's correction changed other unchanged counts from 1,903 to 2,228 on the same code.
- **Confirm:** inspect mutations and the fiber's actual type, name and deletion flags in `recorder.js`. Check aggregate sums against individual commits. Input properties and focus require behavior checks too.
- **Cause:** the recorder confused writes with changed values, removal with no child, and equal function names with equal owners.
- **Correction:** compare original and final values, attribute deletions, distinguish folder-named wrappers. Keep the same definition before and after a product fix. A recorder repair is a separate measurement change with its own comparison.
- **Guard / applied:** `recorder.js`, `cycles.mjs`, `walk.mjs --self-check`; “After the third round” and the flags round in README. No counter definition changes in Q-382.

### 2. A subscription is wider than the read

- **Symptom:** a filter follows keyboard/person changes; an address field reaches an unrelated catalogue/ledger; a closed lab follows its sell-out child's address; each delete link follows a whole ACL snapshot for an equal boolean decision.
- **Confirm:** compare the called layer exports and actual member reads with generated subscriptions. Follow changed route fields, visibility and shared versus instance-dependent rule inputs. Assert zero unrelated updates while preserving every changed decision.
- **Cause:** the producer publishes a wider source than this consumer's output needs. Earlier instances were helper exports analysed as injection entry points, whole-route objects, a child's live read owned by its closed parent, and per-row observation of a shared rule snapshot.
- **Fix:** narrow the existing subscription or move it into the existing visible child; pass only the needed fields. Use the established shared boolean rule for rules independent of props/form state. Preserve guard and event-time reads, polling/freshness, permissions and initialization. A new read/routing contract needs the owner; do not grow the mutable learned-read machinery.
- **Guard / applied:** `f99f14f`, shortcuts 258 (79) → 202 (28); route-fields round 267 (28) → 248 (9), features 82 (7) → 78 (3); closed-lab editor follow-up removed two unchanged updates; ACL round 17 (15) → five (three), `88affed`/`b9a94f8`. Folder/hook, route, ACL, flags and locale tests. These historical numbers overlap other rounds and are not additive. Former entries 3, 4 and 22 are cases of this mechanism. R-07/R-14 remain separate decisions.

### 3. The whole address reaches a narrow consumer

Merged into entry 2. The symptom, confirmation, historical result and guard are recorded there; this number remains for earlier handoffs.

### 4. A closed parent owns a live child read

Merged into entry 2. The symptom, confirmation, historical result and guard are recorded there; this number remains for earlier handoffs.

### 5. Equal values are rebuilt with new identities

- **Symptom:** `props …≈`, equal child elements or collection callbacks change identity. Shared elements reduced sign-in's other updates 158→86 and sign-out's 69→17. Constant callback hoisting reduced search 96 (54) → 56 (14), clearing 175 (102) → 104 (31).
- **Confirm:** find the first reconstructed value and read its actual captures/keys. A callback with the same source can hold different values. A `.map` callback invoked immediately is not itself a child prop.
- **Cause:** equal data, subtrees or constant functions are recreated at a producer. This unifies former entry 7 with input/output sharing.
- **Fix:** remove the needless reconstruction at that producer; static hoisting is appropriate only for capture-free functions. React memo/callback dependencies must include every real input. No new cache, mutable holder, custom comparator to hide stale captures, or write to an earlier render's value. The existing `shareElements`, `tried` and `keep` explain historical figures; their render-time mutations are not templates for new work. Cache/Compiler replacement needs the owner.
- **Guard / applied:** `c189758`, third round/follow-ups; `elements.test.tsx`, `discarded.test.tsx`, `constant-functions.test.ts`, row reorder, concurrency and locale. R-13 remains open. Never exchange a lower count for hidden mutation.

### 6. Event identity is maintained by a second runtime

- **Symptom:** handlers keep functions stable through a mutable call-order registry; Q-367 measured an old closure during a child's layout effect. Five legacy JSX sites remain. There is no established render-count saving from migrating them.
- **Confirm:** inspect generated modules: a `handlers.<name>` attribute is direct; other handler attributes still go through `track`. Follow every caller, keyed row, telemetry site and failure path.
- **Cause:** legacy wrappers stage closures and publish them after commit. Their lifetime and call order duplicate React's callback ownership.
- **Fix:** use the already-approved generated hook: one callback per export, reconstructed arguments and real member dependencies. No ref or latest-value holder. Migrate one folder/site family at a time. A dynamic collection command or passthrough policy that needs a new handler shape goes to the owner first.
- **Guard / applied:** `handlers.test.tsx`, `handlers-module.test.ts`, convention tests; the generated hooks of five fixtures and every app `handlers.ts` are linted with the installed hooks rules, and a module missing one dependency must be reported (R-01, done). Generated wiring exists; R-06's row, flags and palette sites remain. Delete registry machinery only after every caller is migrated, including placeholder/error handling; keep telemetry exactly once.

### 7. A non-event JSX function changes identity

Merged into entry 5. The static-function case and its historical counts are there; this number remains for earlier handoffs.

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

### 11. Operation identity and state have an unresolved ownership tension

- **Symptom / history:** `7429377` retained operation identity and recorded further-step unchanged other updates 746→266 C / 737→257 W, calls 98→94. The previous command was recreated with every operation-state change. That count improvement is history, not proof of a pure implementation.
- **Confirm:** inspect `async.ts`: `Object.assign(run, states[name] ?? idle)` writes during render onto a callable already given to committed consumers. `viewReadsAsync` and the separate operations comparison compensate in the owner's view, but not every child receiving that callable. Q-383's review describes abandoned-render leakage; that scenario has not been reproduced here.
- **Cause / tension:** the owner decided a stable callable carrying its state. Direct JavaScript properties changing behind that same reference are mutable. This conflicts with immutable render inputs and entry 21. Fewer ref calls or lint findings does not resolve it.
- **Decision, not recipe:** keep the decided surface documented while Q-383's review and the draft Option C (operations as XState actors) are considered. Alternatives include generated reads of immutable status beside stable commands, an explicitly sanctioned actor/source with subscribed snapshots, or retaining the current implementation as acknowledged debt. None is selected here. An actor does not by itself authorize a live getter or a render-time write. Do not copy `Object.assign`, add accessors over a holder, or write to an earlier render's value in a new fix.
- **Guard / status:** R-04's measured identity improvement is applied; ownership is open, not “solved”. Require overlap/latest-call, abort/unmount, discarded transition, child status and handler identity tests for the eventual design. R-09 has no additional count saving established. Entry 21 governs every new change.

### 12. A layer hook runs although the folder has no layer

- **Symptom:** Q-378 counted 375 empty form and 249 empty operation hook executions in its main trace. These are work inside renders, not 624 avoidable component renders.
- **Confirm:** a no-layer, empty-async and default-read-only folder on mount and update must call neither absent hook.
- **Cause:** `useLayers` called both hooks for every folder, creating unused stores, effects and subscriptions.
- **Fix:** choose the real hook or frozen empty result once per loaded type, and include hook shape in HMR's remount key.
- **Guard / applied:** `hooks.test.tsx`, `hot.test.tsx`, ordinary-edit state preservation and pending-operation cleanup; `23503a1`, Q-379/R-03 complete. No render saving is attributed to it.

### 13. Progress passes through the overlay that measures the page

- **Symptom:** The supplied first runs of “apply to the nine” have 13 framework / 188 other updates (46 unchanged), C and W. Ten bulk updates show progress. The session clock can move a framework update between preview and apply; compare both steps, not a fixed 13-update target. The unchanged leaves include ten headings, ten DOM wrappers, ten ModalOverlay wrappers and eight close-button pairs. Q-378's Chromium trace had seven modal geometry reads / 13.4 ms here.
- **Confirm:** correlate progress commits with `Modal.mjs`'s body/scroll geometry reads. Do not equate the ten unchanged wrappers with ten measured layout reads.
- **Cause:** the wizard owns the progress and the overlay's changing children together; React Aria republishes dialog context and measures on its render.
- **Fix:** the successful product pattern keeps one overlay around its placeholder/content/error. For bulk, decide a shell that owns open/dismissal/phase and a child that owns progress, using a supported selector boundary. A generic always-dismissible Modal is insufficient. No imperative bridge.
- **Guard / applied:** product modal follow-up complete; R-05 bulk paused for the boundary decision. All nine writes/results, retry, large-change confirmation, Escape/outside click, focus and all skins must survive. Target fewer modal executions/geometry reads; 46 is an opportunity ceiling, not a promised saving.

### 14. Read discovery and fallback retries delay the page

- **Symptom:** supplied cold catalogue has 44 calls/ten thrown and first content commit 348.5/369 ms C/W, one prior commit and four total. Historical Chromium cold fingerprints have 45/11 (`loop1-d-after`) and 55/21 (`loop1-after-chromium-main`), despite equal final framework/other totals. Fast product has eight thrown; slow product about 1,080/1,079 ms idle and none.
- **Confirm:** align read starts, skin/view suspensions, completed attempts, first page/product/reviews commits and paint. `loop1-d-after` adds an app attempt before the tour skin resolves. The 21-call mode adds eleven completed calls through the first row before retrying; its precise unrecorded wake-up needs a read/attempt trace.
- **Cause:** serial child discovery is visible in source; read-start causality still needs a query timeline. The installed reconciler also holds retry commits until fallback + 300 ms. Completed plain calls do not mean visible content, and cache hits do not mean no retry work.
- **Fix / decision:** owner choice on preload and the cold fallback policy, after first-content/query evidence. Do not slow answers, remove a fallback, change idle or copy render caches to improve counts. Keep independent product/reviews errors and authorization.
- **Guard / status:** R-08 open; cold/warm and fast/slow fingerprints, abandonment/entity isolation, failed reviews. A 500 ms readiness improvement remains a hypothesis. Source-backed timing and count causes are separate claims.

### 15. Authentication reaches the same view through several sources

- **Symptom:** main has five unchanged framework updates in both engines: session restoration, app/session at sign-in, app/session at sign-out. Features have three/two. Some wrapper executions reuse prior output rather than call the plain render.
- **Confirm:** inspect session's chart transition, app's session/ACL read and the `asked`/`reason` props separately. In features WebKit coalesces away the app's extra no-change update; it still has session's prop update.
- **Cause:** the session chart, user/permissions/flags reads and app-derived dialog request settle separately. The chart follows whole shown state, even when this particular view does not use its changed part.
- **Fix:** retain correctness until the owner chooses source/read/guard semantics. Narrow pure view inputs with an approved generated boundary if possible; do not batch away user-visible intermediate states or synchronize by delay.
- **Guard / applied:** R-07/R-12 pending; guest/restore/sign-in/out, other-tab and permission-during-write tests. Five is a measured bucket, not five guaranteed removable renders.

### 16. A whole control state reaches a consumer that needs one part

- **Symptom:** the five main Select steps contain 612/615 unchanged other updates C/W: filters 427/429, bulk 155/156, shell 30/30. Across them `SelectValue` alone executes unchanged 33 times in each engine. The traced sort step is 284 (131)/287 (132), including seven unchanged SelectValue and seven corresponding DOM wrappers per engine.
- **Confirm:** follow open/focus/selection state through `SelectInner` to `SelectStateContext`, `SelectValueContext` and `SelectContext`, then `SelectValue` and its span. In installed React Aria Components 1.22.1, SelectInner slots 0/5 are open state/forced update; 23/26 list focus/key; 59 select focus. SelectValue 9/10/11/12/17/18/19 are formatter, selected text/default children/selected values and render-prop memos, not seven independent state updates. Q-382's revision records the complete source map for all 125 observed dependency slots in the two traces.
- **Cause:** `useSelectState` returns the whole state on each update; `SelectInner` republishes it and fresh context props. `SelectValue` subscribes even when selected content is unchanged, then constructs a fresh rendered array and child provider. Its public render-prop values include the whole `state`, so silently narrowing that subscription would break custom children. The controlled selection can also wait for the route's selectedKey; dropping its update changes selection/event semantics.
- **Lower bound / decision:** with this installed component and current contract, the 33 unchanged SelectValue executions are a measured floor for this path, not a theoretical minimum or all 612 removable updates. An app memo cannot block these context deliveries. Options: a dependency correction separating the built-in value display from consumers of full state; a supported app composition reproducing every semantic/markup detail; retain it. Prefer the first after the owner chooses delivery and the full-state render-prop behavior is protected. No package edit, new comparator or replacement control is prescribed here.
- **Guard / status:** no fix applied. Reproduce one closed→open→focus→choose→close in a browser-free control fixture, asserting unchanged selected text and full-state custom child updates; reviewer verifies pointer/keyboard, typeahead, native select/form reset, validation, locale, focus and interrupted entry in both engines. The remaining item/validation/geometry paths are distinct and retain their counts. Locale duplication is entry 24; exit overlap is 18.

### 17. The shell and providers execute before the page commits

- **Symptom:** main Root and QueryClientProvider each execute again 62 times, 22/23 unchanged C/W. Features: 54 each, 23 unchanged. A product open has two unchanged executions each of Shell, two I18nProvider functions, Root and QueryClientProvider.
- **Confirm:** inspect `useTransition`, pending `navigating`, the old/new route, and freshly constructed child elements in `src/main.tsx`. Root is in `other`, not `fw`.
- **Cause:** urgent pending state and the destination transition execute the shell/provider chain; children are rebuilt while Suspense can retain the old page. A context delivery with unchanged DOM can be necessary.
- **Fix:** preserve transition and address semantics. A provider/boundary split needs a trace showing which inputs can remain unchanged; root memoization cannot erase real context delivery. Route ownership is the owner's decision, R-14. No executable reduction is established yet.
- **Guard / applied:** new investigation Q-382; pending indicator, stale page continuity, navigation supersession, locale and skin transitions. Do not subtract the entire shell bucket as waste that can be deleted.

### 18. A closing popover overlaps another step

- **Symptom:** one saved higher Chromium mode adds 167 other updates, 127 unchanged, over four steps; framework committed totals stay 254 (5). The product then throws three more calls in that saved comparison. The reported fourth call and one-in-six frequency are not verified by that trace.
- **Confirm:** inspect PopoverInner's `isExiting`/state changes and collection commits after the next phase begins. In the higher trace an option is selected about 34 ms after opening; the supplied lower-count trace waits about 262 ms. The stylesheet's enter animation is 140 ms. Correlate actual animation identities/events in the next runnable probe before attributing every extra commit.
- **Cause:** the collection stays alive while exiting. Installed `useAnimation` waits for all running element animations, including a still-running entrance; completion calls `flushSync`. `idle()` intentionally does not wait for overlay exits. A later completion can also interrupt React's fallback wait (entry 14). The animation-specific explanation is a source-supported inference, not a completed browser intervention.
- **Fix:** none authorized yet. Investigate which animation is awaited and preserve both opening and closing behavior. Do not add a driver sleep, disable animation, select only the cheaper case for acceptance, or silently change measurement boundaries. A dependency correction needs a reviewed delivery choice if one is necessary.
- **Guard / applied:** new investigation Q-382; full mode distributions and commit timelines, interrupted opening/closing in both engines and all skins. Historical raw trace `loop1-re-after` has no revision stamp; the supplied playbook traces show the lower-count fingerprint. No frequency is inferred. Separate controlled probes of both interruption cases are encouraged; the original workload stays intact.

### 19. Hidden tab data and a changed default reach live controls

- **Symptom:** further slow search has 10 (1) framework / 87 (43) other updates C, versus 9 (0) / 62 (18) W. The extra lab commit changes nothing. A slider step has four lab wrapper updates but two plain render calls; 38 unchanged other updates when slowing, 40 when restoring, both engines.
- **Confirm:** the lab's chart polls both activity lists; a hidden tracked panel's children change while the network panel is selected. `TabPanel` can return null while Tabs/collection state still updates. Sliders also receive a new `defaultValue` after the same control already changed its internal value; DETAIL names it explicitly.
- **Cause:** background activity changes parent-owned children for an inactive tab; the settings read echoes into an uncontrolled control's default. These are separate from the fixed operation function identity.
- **Fix:** consider an explicit subscription boundary for inactive data and a defined initialization/reset ownership for the slider. Preserve polling cadence, log freshness on tab selection, outside setting changes, reopening and focus. Moving a mutable initial value into a holder or hiding all poll updates is not a fix. No complete correction is established in this pass.
- **Guard / applied:** Q-382; entries 4/8/9 supply the established constraints, not an automatic recipe. The 25-extra-render tick moves between steps; a per-step minimum is not a gain. Owner read/form policy may be needed.

### 20. A partial gate accepts a regressed or differently partitioned visit

- **Symptom:** the current gate only limits framework again/unchanged. The operations change is mainly in other. A split can add a useful framework update while reducing many other updates; a merge can do the opposite.
- **Confirm:** read `totals.mjs`, `gate.mjs`, baseline and per-step traces. The gate still compares minima for separate metrics with a modal baseline; those minima need not belong to one run or fingerprint. A green result is not acceptance under this playbook.
- **Cause:** whole-visit thresholds and partial buckets lose locality, causality and trade-offs. The old further retention/failure omission is already fixed; do not requeue it.
- **Proposal:** retain every run's per-step counts, commits and failures; compare framework, plumbing, other, mounts, calls, thrown and suspends from one whole run. Use exact stable-step vectors and named accepted fingerprints for variable steps only after calibration. Retain ordered cold/warm samples and cross-step completion. Include first-content evidence alongside counts. No new threshold or baseline is set here: the owner chooses budgets and accepted modes.
- **Splits:** report added mounts/useful updates beside removed work in every bucket and preserved own output/behavior. A useful split is not automatically a regression, nor a lower framework count automatically a win. The owner can approve a specific per-step budget change after that review; never merge folders or move work merely to pass the old gate.
- **Guard / applied:** `89d0cdc` retains every run's further totals/misses and rejects further-only failures through `played`, with `totals.test.mjs`. The widened per-step gate is still a proposal. Test mixed-metric minima from different runs, an other/plumbing-only regression, split accounting and a further-only failure. Run the existing gate as a legacy check and disclose its disagreement with the complete comparison.

### 21. Ref removal is mistaken for render reduction

- **Symptom:** an ownership cleanup is assigned a saving without a rendered component or workload. Entity switching is not present in these visits; form typing already costs zero framework updates.
- **Confirm:** inventory actual holders and callers on the current revision. R-02 is already resolved by `a8c780b`: Root requires its client. The old proposal to initialize a private client is obsolete. R-03/R-04 are complete too.
- **Cause:** caches, event-time sources, operation cancellation and chart/form ownership solve different problems and have different costs. Moving a ref into mutable state changes no ownership.
- **Fix:** follow Q-367's dependency order with the current prohibition on mutable holders. R-07 static reads; R-09 operation lifetime; R-10 forms; R-11 entity/client scope; R-12 guards; R-13 caches/Compiler; R-14 routing each need their own owner decision and behavior tests. Do not implement Q-367's old mutable-store suggestions under the present rules.
- **Guard / applied:** hooks lint and focused lifecycle/concurrency tests. No new ref, ref-filling effect, mutable state store, module-level per-instance state or suppression. Zero count gain until measured; no Compiler or new dependency without approval. Entry 11 is an unresolved existing exception, not permission to repeat it. Count refs, effects and every suppression before/after, and inspect actual holders: syntax counts alone do not establish purity.

### 22. Every instance subscribes to the same rule's whole snapshot

Merged into entry 2. The symptom, confirmation, historical result and guard are recorded there; this number remains for earlier handoffs.

### 23. A changed render prop never reaches the page

- **Symptom:** the palette's search started twice with an unchanged page; its intended `aria-busy` prop was on a Menu that did not forward it. The fourth round made those two updates observable.
- **Confirm:** inspect the actual DOM and the installed control's supported attributes, then check the intended accessible announcement. Do not assume a prop placed in JSX was delivered.
- **Cause:** a semantic state was computed correctly but handed to a component that did not expose it.
- **Fix:** historically, put the existing busy state on the owning `search` element. This is a behavior/markup correction, not removal of render work. Under a brief requiring identical markup, report a newly found case and pause instead of moving the attribute to improve the count.
- **Guard / applied:** palette pending behavior and immediate post-idle checks; README fourth round. Current commands pending/results updates change the page. Do not count this old correction as a remaining speed gain.

### 24. The requested locale arrives before the displayed locale

- **Symptom:** the two language steps contain 666/616 unchanged other updates C/W. On each switch, lab 66, skin ten and filters 27 execute unchanged in an early locale-context commit, then receive translated framework inputs later: 103 early updates per switch in each engine.
- **Confirm:** `speak` emits `localechange`; Shell's locale state (slot 5, pending flag 6) reaches the outer I18nProvider; Root still supplies its old `shown` locale until `loadShown` resolves and slot 16 updates. The installed I18nProvider memo depends on requested locale. At the first wave, a closed SelectInner/SelectValue reads the new locale with old item labels. SelectInner 92/116 are the collator-dependent keyboard delegate and localized formatter memos; SelectValue 9/17 are list/placeholder formatters. This is a second producer path, not F1's redundant popstate transitions.
- **Cause:** React Aria and framework messages publish the same locale choice at different commits. Existing Root comments and the shell's contract say the old locale remains until all messages are ready. Localized controls consequently process mixed old/new inputs and then process the final inputs again.
- **Fix to hand off:** add one plain framework folder inside Root around its page children, receiving injected `locale` and `children`, whose render supplies the installed I18nProvider with that displayed locale. Keep the outer provider/failure region so failures remain outside Root's Suspense. Do not import private LocaleContext, add a callback API, ref, effect, cache or new dependency, or move failure UI under Suspense. Keep all page/gallery branches covered and markup/styles identical. This uses the existing injection contract; if the executor needs to change that contract, return the item.
- **Guard / target:** a delayed-message test must keep both locale consumers old until messages settle, then change both once; rapid switches and failed loads follow the existing policy. Test numeric/date formatting, direction, option labels, typeahead, dialogs/portals, native hidden options, failure notifications and locale back/forward. Target removal of the separate 103-update wave per switch (206 across two), not all 666 and not an exact net saving: count the added boundary and the final combined commit. No implementation or fresh count comparison yet. Independent cause review precedes dispatch.

## One item for an executor

The reviewer fills this in after a second reader has checked the concrete cause. The template remains provisional until an item has completed execution and independent acceptance; the shell correction is the first dispatched trial. An owner-blocked row is not a work order. Work on one item only; leave unrelated improvements in the queue.

```text
Item and playbook entry:
Revision, branch, allowed paths and ports:
Owner decisions already made (quote the relevant contract):
Symptom: visit, step, component/instance, why, C/W calls/mounts/again/unchanged/thrown:
Evidence files, per-step fingerprint, run ordinal/cold-warm state and commit timestamps:
First-content landmark/time (commit or paint), commits before it and total commits:
Root cause; decoded hook/source map; second reader's confirmation:
How to confirm it without changing the measurement:
Smallest correction; existing helper/generated boundary to reuse:
Scope: producers, every caller, layers, exports, fixtures, tests, configuration:
Behavior/markup/styles/accessibility that must remain identical:
Expected gain: measured saving or explicit target/upper bound, never a guess presented as fact:
Required browser-free behavior/count regression test and before/after samples:
Browser-only evidence and named reviewer who will collect it if execution cannot:
Checks and commands; baseline changes allowed? (normally no):
Purity: the fix writes nothing onto a value an earlier render made; no render-time publication.
Ref calls, effect calls (passive/layout/insertion), and lint suppressions before/after:
Count direct calls and custom holders; list suppression file/rule counts and inline disables.
Stop conditions specific to this item:
Hand back: diff, cause, test failure before/pass after, all C/W samples, misses/errors,
unexpected mounts/calls, ref/effect/suppression deltas, first-content/commit deltas,
limitations, remaining decisions, and entry update. Leave uncommitted.
```

Stop and return the item if the cause differs, the smallest fix needs an undecided API, behavior/markup/styles change, a new dependency, a new cache or a prohibited holder; if a check would have to be weakened; if a regression cannot be explained; or if the evidence cannot distinguish a saving from another mode. Do the independent authorized checks first. A browser launch failure is reported as such, never as a passing visit. Do not suppress warnings, optimize a named measured flow, freeze data, hide a result or depend on timing. Do not move work into an effect, DOM write, comparator or renamed function to escape a bucket. Do not write to any earlier render's value. A ref count falling while a new holder appears is a failed purity check.

The reviewer independently checks the dependency lists and connected code, runs `npm run check` and `npm run lint:slop -- <changed code files>`, the relevant production E2E flows on the assigned preview port, both cycle visits and the gate, and compares every affected step and neighboring phase across every bucket first, with whole-run totals as a checksum. Include mounts and added useful work from splits; the legacy gate cannot adjudicate that trade-off. For documentation-only changes report that Oxlint has no eligible code files. Run `npx oxfmt` on changed files. Refuse a reduction that costs focus, cancellation, permissions, data correctness, progress, or an unreported increase elsewhere. Do not change the baseline merely to pass; a deliberate budget change goes to the owner with evidence. Bring the owner two or three options and a recommendation for each paused contract. Record accepted commits and counts here so the next pass begins with what is already known.
