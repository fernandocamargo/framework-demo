# Render cycles

The [rendering playbook](PLAYBOOK.md) describes the walk from Root to the controls, the causes already found, and how one measured fix is handed off and reviewed. `node perf/walk.mjs perf/out/<label>/cycles.json` expands a saved first-run trace into every step and cause group, with the further steps counted separately; it changes no measurement or gate.

What a visit costs in renders, measured so that a change to the framework or the app shows its price. `npm run perf` builds the app with React's profiling build, unminified (`perf/vite.config.ts`), and drives the flow in `perf/steps.mjs` through it in headless Chromium (`perf/cycles.mjs`), in the memory world. Each step acts, waits for `window.__framework.idle()`, and checks the page once.

Per step it counts:

- **calls**: every call of a framework component's render, and **thrown**, the calls whose output React never showed (a render it threw away, which no later render reused);
- **fw**: the framework components React committed, new or again, and of those rendered again, how many changed nothing in the page;
- **plumbing**: the framework's wrappers around them;
- **other**: every other component (react-aria's, the shell's), the same way;
- **ms** and **wasted**: their render time in the profiling build, and the part that changed nothing;
- **miss**: a check that failed right after `idle()`, which would make an end-to-end test flaky.

A change to the page is an attribute or a text that holds another value than before the commit, or a node added or removed. Writing a value again is not one: React sets an input's `name` and `type` at each of its renders.

After the visit's 29 steps come twelve more, counted apart (`further`): the lab left open for two seconds, a network slowed by 500 ms, the states gallery and the way back, then two catalogue sort choices. The first chooses while the popover's entrance animation is running; the second waits for that animation's `finished` promise. Both check the selected text and removal, and the first checks that removal happened by the next frame. The visit's totals stay comparable from one change to the next. `runs.json` keeps each run's further counts and misses under `further`, beside the existing visit figures; `cycles.json` still holds the first run's full trace.

`LABEL`, `RUNS`, `CPU` (Chromium's throttling), `ENGINE` (`chromium` or `webkit`), `DETAIL=1` (which components changed nothing, why, and which framework component they are inside of) and `CHROMIUM` / `WEBKIT` (browser executables) change the run. `TIMELINE=1` prints the open, entrance start and end, choice, `data-exiting` and removal events beside every Select step, with times relative to the open. Removal is also labelled by task/frame order; the checks do not use elapsed time. The probe observes animations, so use ordinary runs for count comparisons. `node perf/cycles.mjs` runs again on the last build. Results go to `perf/out/<LABEL>/`.

## The gate

`npm run perf:gate` (`perf/gate.mjs`) fails when the framework's re-renders grow, and CI runs it as a job of its own. It builds the perf build, plays both visits in Chromium and in WebKit, and compares two figures per engine and visit with `perf/baseline.json`: the framework components **rendered again**, and those of them **with no change** in the page. More than the baseline fails; fewer passes, and says to write the baseline again so the gain is kept.

- **Timing moves a visit's figures by one.** From one run to the next a commit lands apart from another, or with it. On macOS, Chromium's visit rendered the framework's components again 254 times in most runs and 255 in some; WebKit's 255 in ten runs and 254 in one; the features visits 78 and 77 in every run. On CI's Ubuntu runner, Chromium's visit gave 255 in seven runs and 254 in the eighth, WebKit's 256 in seven runs and 257 in three.
- **The baseline is the figure most runs give**, and a visit is played until its least figures are within it, ten times at most (`RUNS`): usually once per engine and visit, and the gate takes 35 to 45 seconds. A change that adds two renders or more to a visit is over the baseline in every run on record, and fails after the tenth, four to five minutes later. A change of one render can pass, when timing gives a run one under the usual. A machine too busy to play a visit once in ten runs as a quiet one does fails too: run it again before reading it as the code's.
- **Reported, never failing:** react-aria's and the shell's re-renders and the renders React threw away. They move from run to run (4390 to 4730 of the former in Chromium's visit on macOS; 27 and 51 thrown away in two WebKit runs of the features visit on CI).
- A run with a failed check in the visit or further steps, or a page error did not play the whole visit: it is left out, and a visit with no clean run fails.
- The gate prints each run's further counts, including failed runs. No further render threshold is set; those counts need same-platform calibration and an owner decision.
- **One baseline per platform.** `perf/baseline.json` holds the figures of each platform the gate runs on (`darwin`, `linux`), and the gate compares with its own: WebKit's visit renders one or two more on CI's Ubuntu runner than on macOS. Why is not known yet; fonts and timers differ between the two. The Linux figures come from the gate's runs on CI, where the usual figure also moves between runners: two runs of the same rendering code gave Chromium's visit 255 in seven runs of eight, then 256 in nine of ten, and WebKit's 256, then 257 (with 6 changing nothing in most runs of both). Linux's baseline is the higher of the two, so on CI the gate catches two renders more on a visit, and one only on a runner that does not hide it.

`npm run perf:baseline` plays each visit five times in each engine and writes the figure most of them give (the higher of two as common) to `perf/baseline.json`, under the platform it runs on, on a quiet machine. Linux's are written from the gate's runs on CI, which print each run's figures. Write it again when a change is meant to cost renders (a new step in a visit, a new component on a page the visits open, a layer that must render where none did), or when a change saved some. The commit that changes the baseline says why, in its message: the file's history is the history of what the framework's renders cost. A baseline is not written again to get a red gate green: `DETAIL=1 node perf/cycles.mjs` says which components rendered, and why.

## Baseline

Before the i18n, ACL and other layers (`a54f01e`), Chromium, one run:

|                      |                                                             |
| -------------------- | ----------------------------------------------------------- |
| steps, misses        | 24, 0                                                       |
| render calls         | 200                                                         |
| framework components | 81 mounted, 135 rendered again, 38 of them changing nothing |
| other components     | 4,389 rendered again, 2,201 of them changing nothing        |
| render time          | 128.8 ms, 32.1 ms of it changing nothing                    |

The costliest step is typing six keys in the editor's title: 602 react-aria components render again, 366 of them changing nothing, because the editor's render is one function of every value of the form.

## After i18n

The flow gains two steps, a switch to Brazilian Portuguese and back. Chromium, one run:

|                                                        | baseline           | i18n               |
| ------------------------------------------------------ | ------------------ | ------------------ |
| steps, misses                                          | 24, 0              | 26, 0              |
| render calls                                           | 200                | 235                |
| framework components rendered again (changing nothing) | 135 (38)           | 171 (40)           |
| other components rendered again (changing nothing)     | 4,389 (2,201)      | 5,594 (2,568)      |
| render time (changing nothing)                         | 128.8 ms (32.1 ms) | 150.9 ms (36.0 ms) |

- Each switch of locale renders the 18 framework components on screen that read the locale, every one of them changing the page, in one commit; the components that read none of it do not render.
- Without the two new steps, the other components render again 4,310 times (2,034 changing nothing), fewer than the baseline's 4,389 (2,201): what the render gets now keeps the identity of every part that did not change, and a render that would get the same is not called.

## After the ACL

Every row now holds a delete link of its own (`product/remove-link`), with a rule of its own; the session reads who is signed in from the profile. Chromium, one run, the same 26 steps:

|                                                                 | i18n               | ACL                |
| --------------------------------------------------------------- | ------------------ | ------------------ |
| misses                                                          | 0                  | 0                  |
| render calls                                                    | 235                | 353                |
| framework components mounted; rendered again (changing nothing) | 82; 171 (40)       | 155; 220 (48)      |
| other components rendered again (changing nothing)              | 5,594 (2,568)      | 5,601 (2,575)      |
| render time (changing nothing)                                  | 150.9 ms (36.0 ms) | 151.9 ms (35.0 ms) |

- The new calls and mounts are the 12 delete links each list shows.
- A sign-in or a sign-out decides every rule again. The delete link's rule reads only `user` and `acl`, so it is decided where the user read answers, and no link renders unless its answer changes: signing in renders 5 framework components again (3 of them changing nothing), against 17 (15) when each link read the user itself.

## After the ACL became the backend's snapshot

The rules test `/auth/permissions`' snapshot instead of role names; the charts of the editor, the delete dialog and the bulk change are declared from it. Chromium, one run, the same 26 steps: 0 misses, 358 render calls, framework components rendered again 220 times (48 changing nothing), render time 136.3 ms (30.3 ms changing nothing). Signing in still renders 5 framework components again: each follows only the parts of the snapshot it reads, and the rules that read only `acl` are decided where the snapshot is read.

## After shortcuts

Every folder may declare its keys; the header holds a `?` button with a chart of its own, and the catalogue, the editor, the product dialog and the bulk change declare keys. Chromium, one run, the same 26 steps: 0 misses, 357 render calls, framework components rendered again 202 times (28 changing nothing), render time 159.4 ms (42.0 ms changing nothing).

The first count with shortcuts was 258 (79). Two things the slice made visible, and fixed:

- A component with a `state.ts` read the route on every render, so it rendered again at every change of address. It needs the route only until its first commit, to create its chart; it reads it only then.
- The plugin read every exported function of a `props.ts` as one the framework calls. The filter bar's `props.ts` exports a helper with a plain parameter (`sorting(id)`), which counted as reading everything: the person, the snapshot, the route, and now the keys on screen. Only the functions the framework calls are read now.

The recorder now says, for a component that rendered again on its own, which of its hooks hold something new and which contexts it read changed (`DETAIL=1`). What is left is mostly the catalogue and the network lab, whose default reads read the route, rendering again at every change of address and finding the same query.

## After optimistic writes and the tabs' channel

Each row has a count with a button on either side, offered to someone signed in who may change products; a count, a save and a deletion show at once. Chromium, one run, the same 26 steps: 0 misses, 385 render calls, framework components rendered again 226 times (28 changing nothing), render time 171.2 ms (39.9 ms changing nothing).

- The 24 more re-renders are the 12 rows of the list gaining their buttons at the sign-in and losing them at the sign-out: each changes the page.
- A save renders the row it changed once, when it is sent. The optimistic change bumps the product's version as the server will, so the server's answer finds nothing new and renders nothing; before it did, the row rendered again for the version alone.

## After the inspector

The data layer's events go to the pipelines, and the lab's tracker listens from the start. The same 26 steps count the same: 0 misses, 385 render calls, framework components rendered again 226 times (28 changing nothing). Events are dispatched after a microtask, outside any render, and nothing renders them until the lab is open.

## After the states gallery

The header has a "States" link; nothing else in the visit changes. 0 misses, 385 render calls, framework components rendered again 226 times (28 changing nothing). A component's form and chart read whether they are pinned once per render, from a context nothing changes outside the gallery.

## After flags

`Root`'s `flags` is a read for the person signed in; the rows read one, two delete rules another, the bulk change's guard a third. The flow gains three steps after the bulk change: stock count served to nobody, deletions paused, and both served as before, each as another tab would serve them (localStorage and a `storage` event). Chromium, one run, 29 steps: 0 misses, 426 render calls, framework components rendered again 274 times (28 changing nothing), render time 180.8 ms (42.4 ms changing nothing).

- On the 26 steps from before: 378 render calls, against 385. Opening the catalogue takes 37, against 41. `Root` now starts its three reads side by side as it mounts. The first count with flags was 392 (48 for opening the catalogue): the rows were the first to read the flags, so the read started there and suspended them, and React rendered the components around them again.
- A flag served another way renders only what reads it: stock count to nobody renders the 12 rows (each loses its buttons); deletions paused renders the 12 delete links (each goes); serving both back renders the 24 again.
- A component follows only the flags it reads, compared with what it last rendered: the first flag change after a component mounts counts from the keys its render read, not from none.
- The recorder now counts a component that removes all it rendered (a delete link that renders nothing) as changing the page. React's flags say so, since the removal shows in the mutations only at the parent node.

## After the editor's keystrokes

Two changes for every component, and one for forms. Chromium, one run, the same 29 steps: 0 misses, 422 render calls, framework components rendered again 267 times (28 changing nothing), other components rendered again 4,748 times (1,869 changing nothing), render time 173.0 ms (27.1 ms changing nothing). Before: 426 render calls, 5,976 (2,785) other re-renders, 42.4 ms changing nothing.

- **Shared elements.** A render's output shares with the last one every element equal to the one at the same place, and React skips those. Signing in renders 86 of react-aria's components again instead of 158; signing out, 17 instead of 69; serving a flag another way, none around the rows.
- **Handlers as events.** Each handler site has one wrapper for the instance's life, calling the closure of the last committed render, so a new closure does not make a new element.
- **A form that follows what it reads.** The values live in a store per instance; a component follows only the values its files read. The editor's fields hold what is typed and start from `form.initial`. Typing six keys in the title: no framework render (6 before) and 50 of react-aria's components (602 before), 18 of them changing nothing (366 before); 0.8 ms of render time (7.5 ms before). The rest is react-aria's text field, which renders its label, input and error with each key.

Shared elements alone barely moved typing (584, 348): while the editor held the value, each key changed the title field's element and every element around it, and react-aria's `Form`, `Dialog` and `Modal` gave their fields new context values.

## After route fields

Each field of the route has a context of its own, and a component reads only the fields it uses. Chromium, the same 29 steps, measured before and after on the same day: 0 misses in three runs, 422 render calls, framework components rendered again 248 times (9 changing nothing), other components 4,700 times (1,821 changing nothing). Before: 267 (28) and 4,870 (1,969). Render time moves by more than 10 ms between runs of the same build, so these runs show no change in time.

- **A default read follows the fields it read.** The catalogue's read follows `q`, `category`, `sort`, `order` and `page`; the network lab's, `edit`. Opening or closing a product or the bulk change no longer renders either of them: opening a product renders two framework components again instead of four, the shell's `App` twice for `navigating`. The editor opening or closing renders the lab, not the catalogue.
- **A chart's first reads go field by field.** A component with a `state.ts` read the whole route in its first render, for its chart, and so rendered once more at the first change of address after it mounted. The first search rendered the lab and the shortcut list for that alone. It now follows only the fields its chart read. The chart is now created in the render, not in `useState`'s initializer, since creating it reads those contexts.
- **The shell's toast region is one element.** `main.tsx` renders again at every change of address; the toast region is now an element made once, so React skips it: four fewer re-renders per change of address.

What is left at a change of filter is real: the rows' links carry the filters, so each row renders, and react-aria renders inside them (151 changing nothing when sorting by price).

## After the third round

An adversarial pass: the counts were measured again, and the recorder itself was checked. Chromium, three runs, before and after in one sitting; the same in WebKit.

The recorder first, since two of its answers were wrong:

- **A value written again is not a change.** React sets an input's `name` and `type` at each render of the input, and the recorder took that for a change to the page. On the same build, the other components' re-renders that change nothing went from 1,903 to 2,228, the open lab's among them.
- **react-aria has a `Component` of its own**, which was counted as the framework's wrapper.
- **`thrown`** is new: the render calls whose output React never showed.
- **`DETAIL=1` says which framework component holds each re-render.** At a change of filter, the re-renders that change nothing are not inside the rows, as "After route fields" says: every row's render changes a link. They are inside the filter bar, in react-aria's `Select` as it opens, is moved over and closes.

With the recorder corrected, the visit's 29 steps:

|                                                                           | before (`62d5dee`) | after                |
| ------------------------------------------------------------------------- | ------------------ | -------------------- |
| misses, in 5 runs                                                         | 0                  | 0                    |
| render calls, thrown away                                                 | 420, 20            | 417 to 420, 17 to 20 |
| framework components rendered again (changing nothing)                    | 248 (9)            | 246 (7)              |
| other components rendered again (changing nothing)                        | 4,991 (2,228)      | 4,722 (1,957)        |
| of those changing nothing: in a commit where a component of ours rendered | 736                | 465                  |
| of those changing nothing: react-aria alone, and the shell                | 1,430 and 62       | 1,430 and 62         |

WebKit, the same steps: 0 misses in 5 runs, 418 render calls (17 thrown away), framework 247 (7), other 4,484 (1,762); before, 248 (9) and 4,722 (2,002).

What changed:

- **A chart that moves and shows nothing new renders nothing.** A render gets another `state` only when the states, the context or the status changed, or the chart came to rest; an action that returns what the context holds keeps the context. The lab, open and idle, entered its state again every second and rendered twice each time: in two seconds, 4 render calls and 130 of react-aria's re-renders, 120 of them changing nothing. Now 1 and 52, for the one tick that brings new requests.
- **A function in the JSX that uses nothing of the render is made once.** `{(item) => <ListBoxItem … />}` was a new function at every render, so its list was never the element shown before, and react-aria rendered the select around it again. The plugin moves such a function out of the render. A search renders 56 of react-aria's components again (14 changing nothing), against 96 (54); clearing it, 104 (31) against 175 (102).
- **The filter bar is given the fields it shows**, not the filters whole: another page of the same list no longer renders it (2 of the 9).
- **A render that returns what it returned is the element React showed**, so nothing below it renders.
- **A guard reads the decision React committed.** A render React threw away left its acl decision where the chart's guards read it; `discarded.test.tsx` holds the case.

What is left, and why:

- **7 framework re-renders that change nothing.** The session's chart going from `restoring` to `signedOut`; the closed lab when the editor opens and closes (its read reads `route.edit`, for a button it does not show); the app and the session at a sign-in and a sign-out, where two layers learn of one event. In two of them the render is not called.
- **17 to 20 render calls thrown away**, 6 when the catalogue opens and 11 to 14 when a product does, by how many of react-aria's commits fall in the wait. React holds content back until 300 ms after a placeholder showed, and renders it again after each other commit in between; the memory world answers in 3 ms. With the lab's latency at 500 ms (the further steps), none is thrown away. The same rule shows the catalogue at about 360 ms when it was ready at 155 ms.
- **1,430 re-renders of react-aria alone**: its own state, in commits where no component of ours rendered.
- **A function that reads the render** (the lab's slider outputs, the bulk change's progress bar) is still new at each render.

Beyond the visit, measured once: fifteen navigations left before they answer, at 750 ms of latency, each end as a fresh load of the same address, in both engines. A save in another tab renders the catalogue and one row. WebKit renders the rows twice at a sign-in from another tab (the permissions and the flags arrive apart), Chromium once. Over 210 rounds of navigation the page keeps 114 more DOM nodes per round: react-aria's `runAfterTransition` holds an element removed while one of its CSS transitions runs, and through it the editor closed by a save. Opening and closing the editor at a person's pace keeps none.

## After the third round's follow-ups

Four of the round's options, built. The same 39 steps, before and after on one day; Chromium three runs, WebKit three.

|                                             | Chromium before | after                           | WebKit before | after         |
| ------------------------------------------- | --------------- | ------------------------------- | ------------- | ------------- |
| misses                                      | 0               | 0                               | 0             | 0             |
| render calls, thrown away                   | 417, 17         | 419, 17                         | 418, 17       | 417, 14       |
| framework rendered again (changing nothing) | 246 (7)         | 246 (5)                         | 247 (7)       | 247 (5)       |
| other rendered again (changing nothing)     | 4,650 (1,895)   | 4,573 to 4,687 (1,834 to 1,925) | 4,484 (1,762) | 4,451 (1,728) |
| further steps: framework (changing nothing) | 34 (2)          | 34 (4)                          | 34 (1)        | 34 (3)        |
| further steps: other (changing nothing)     | 741 (371)       | 579 (229)                       | 744 (362)     | 582 (220)     |

- **A view follows the route fields its files read.** The lab's "sell out" button is a component of its own that reads `route.edit`; the lab reads none of the address. The editor opening and closing no longer renders the lab (2 of the 7).
- **The lab's sliders keep the keyboard.** A `key` that changed with the setting mounted them again at each step. They now hold their own value, as the editor's fields do. The further steps' slider steps focus once and press twice. The lab still renders once when its setting changes, to learn it, and shows nothing new: those are the further steps' two more "changing nothing", against 162 fewer of react-aria's re-renders.
- **A function that reads the render is kept** while what it reads is the same (`keep`). The sliders' outputs now get the messages themselves, which stay the same.
- **A product's modal opens once.** `components/modal` holds the overlay and has no read; the product's placeholder, content and error are each its `Dialog` inside it. One overlay mounts and the modal animates in once (twice before). React still holds the content 300 ms after the skeleton shows: the renders thrown away at "open a product" are 11 in every run after, and 11 to 14 before, by how many of react-aria's commits fall in the wait. Its react-aria re-renders are 113 (45) in every run after, and between 88 (30) and 128 (53) before.

## After the markup names what each piece is

Microdata from schema.org, HTML's elements and ARIA's roles in place of presentational classes; glyphs, placeholders and spinners drawn by the skins (Chromium):

| Visit                                       | Before                          | After         |
| ------------------------------------------- | ------------------------------- | ------------- |
| misses                                      | 0                               | 0             |
| render calls, thrown away                   | 419, 17                         | 419, 17       |
| framework rendered again (changing nothing) | 246 (5)                         | 246 (5)       |
| other rendered again (changing nothing)     | 4,573 to 4,687 (1,834 to 1,925) | 4,535 (1,811) |
| further steps: framework (changing nothing) | 34 (4)                          | 34 (4)        |
| further steps: other (changing nothing)     | 579 (229)                       | 571 (229)     |

- The framework renders exactly as before. react-aria's progress bar and the hidden labels of the selects are gone (a native `progress`, and the selects' own `aria-label`), so a few of its components no longer render.
- steps.mjs counts a list's own items (`:scope > li`): a product's row now holds a list of its commands.

## After Broadsheet and the five features

Broadsheet, Blueprint, the pages in the address, the stock report, the orders page and its live map, the guided tour and the command palette (`29336a1` to `a313dbc`). The same 39 steps, before and after on one day, three runs each; counts from the first run.

| Visit                                                | Chromium before | after         | WebKit before | after         |
| ---------------------------------------------------- | --------------- | ------------- | ------------- | ------------- |
| misses                                               | 0               | 0             | 0             | 0             |
| render calls, thrown away                            | 419, 17         | 432, 21       | 417, 14       | 430, 18       |
| framework mounted; rendered again (changing nothing) | 158; 246 (5)    | 161; 252 (5)  | 158; 247 (5)  | 161; 253 (5)  |
| other rendered again (changing nothing)              | 4,544 (1,799)   | 4,589 (1,822) | 4,290 (1,606) | 4,467 (1,712) |
| further steps: framework (changing nothing)          | 34 (4)          | 34 (4)        | 34 (3)        | 34 (3)        |
| further steps: other (changing nothing)              | 571 (229)       | 613 (261)     | 568 (220)     | 618 (252)     |

- The visit does not open the new pages (the report, the orders): this is what the features cost the pages that were already there.
- **The header holds three more framework components**: the skin's switch, the tour's button and the palette. They mount with the page (3 more at "open the catalogue" and at "back to the catalogue"), and each renders again at a switch of language, changing the page (3 more at each switch). Nothing else in the framework's counts moved.
- **Their react-aria buttons and links**: 32 more mounted with the page, and 45 to 60 more re-renders at each switch of language. The other steps' differences are within what runs of one build vary by.
- **The states gallery's step counted 6 charts.** The tour and the palette brought two more, so the step missed in every run of both engines until it counted the folders with a chart, as the end-to-end flow does. Measured again with that check: no misses, the same counts, and WebKit's thrown-away renders at 33, which vary with how many of react-aria's commits fall in React's 300 ms wait.

## After the fourth round

react-doctor's two scans read against these counts, the pages the visit did not open measured, and the framework's hooks and refs made checkable. Before and after in one sitting; Chromium and WebKit, five runs after, three before.

| Visit                                                | Chromium before | after         | WebKit before | after         |
| ---------------------------------------------------- | --------------- | ------------- | ------------- | ------------- |
| misses                                               | 0               | 0             | 0             | 0             |
| render calls, thrown away                            | 433, 22         | 432, 21       | 430, 18       | 429, 18       |
| framework mounted; rendered again (changing nothing) | 161; 252 (5)    | 161; 252 (5)  | 161; 253 (5)  | 161; 252 (5)  |
| other rendered again (changing nothing)              | 4,598 (1,812)   | 4,703 (1,913) | 4,465 (1,712) | 4,471 (1,712) |
| further steps: framework (changing nothing)          | 34 (4)          | 34 (4)        | 34 (3)        | 34 (3)        |

The visit renders as it did: the round changed what can be verified, not what it costs. `cycles.mjs` now prints every run's totals. In Chromium's five runs after, each made 432 render calls with 21 thrown away, and 252 framework re-renders with 5 changing nothing; react-aria's count moved between 4,589 and 4,708 with which of its commits fall in a wait. WebKit's runs made 429 or 430 calls and 252 or 253 re-renders.

**The features visit** (`VISIT=features`): 18 steps over the report, the orders page as a guest and as an admin, a state, an order, the live map on and off, the palette and the tour. Its own totals, Chromium, three runs before the two fixes and five after:

|                                                      | before      | after       |
| ---------------------------------------------------- | ----------- | ----------- |
| misses                                               | 0           | 0           |
| render calls, thrown away                            | 188, 23     | 186, 23     |
| framework mounted; rendered again (changing nothing) | 87; 82 (7)  | 87; 78 (3)  |
| other rendered again (changing nothing)              | 1,425 (533) | 1,390 (501) |

WebKit after, five runs: 0 misses, 184 or 185 calls (22 or 23 thrown away), 77 (2), 1,372 to 1,386 (497 to 499). The live map draws in both headless engines; its basemap is answered by the driver with an empty style.

- **The ledger rendered at every change of address.** Its rows' links were written from the whole route (`format({ ...route, cart })`), and spreading the route follows all of it. They are written from the ledger's own state and page now: an order opening or closing over it renders it no more.
- **The palette's `aria-busy` never reached the page**: react-aria's `Menu` passes none on. It is on the `search` element now, so the two renders the search's start costs change the page.
- The three left are the visit's: the session's chart settling as the page opens, and the app and the session at a sign-in.

**Frames** (`npm run perf:frames`, `perf/frames.mjs`): the browser's own long animation frames and interaction times per step, nothing injected. Three runs of each visit: no long frame, and no interaction over 40 ms. `TRACE=1` lists the style and layout a script forced, by the code that asked: 171 ms over the visit while traced, in 477 events, none from the app or the framework. react-aria places a select's popover, focuses a dialog, locks the scroll, checks for an enter animation, and reads a computed style in its modal's render (12 ms in the eight renders of the bulk change applying). React removes the element that holds the focus, and the browser settles style and layout to move it (2 to 3 ms: the Previous link going back to page 1, the search field after a search, a dialog closing).

**react-doctor** (`npm run doctor`, `npm run doctor runtime`; `perf/doctor.mjs`), version 0.9.23, telemetry off:

- Its runtime scan reports 11 or 12 long frames in the visit, the longest 137 to 147 ms, at a search and at going back a page. They are its own. Its trace records `disabled-by-default-devtools.timeline.invalidationTracking`, which keeps a stack for every element a change invalidates. `frames.mjs` traced without that category: no task over 50 ms. With it (`CATEGORIES=…`): 138 ms at the search and 129 ms going back a page, in `removeChild`. The scan's interaction times stand: 64 ms at most, before and after.
- Its static scan, in `framework/runtime`: `rules-of-hooks` 15 before, 1 after (`reading` in `root.tsx`, the route read on demand with `use`); `no-ref-current-in-render` 7 before, 3 after (the render's memo of the last output worked out, the chart's actor created once, the chart's declaration kept while it would read the same). Outside `perf/`'s own output: 85 findings before, 62 after, 49 of them render, placeholder and error files that export a function Fast Refresh does not take for a component, which the framework's own hot replacement now answers.

What changed in the framework, each with a test: services read the entity React committed (`entity.test.tsx`); a component's hooks are chosen once per type (`hooks.test.tsx`); what a render is compared with is what React committed (`discarded.test.tsx`); a render that reads the route itself follows it (`route.test.tsx`); an edit under the dev server keeps the page (`hot.test.tsx`).

## After the search keeps its field

The catalogue's search field was keyed by the address's text, so it followed the back button, and its own search mounted it again and dropped the focus. It shows its form's text now, and the form follows the address (`form.ts`'s `seed` reads the props). Before and after in one sitting, three runs each; counts from the first run.

| Visit                                                | Chromium before | after         | WebKit before | after         |
| ---------------------------------------------------- | --------------- | ------------- | ------------- | ------------- |
| misses                                               | 0               | 0             | 0             | 0             |
| render calls, thrown away                            | 429, 18         | 431, 18       | 430, 18       | 432, 18       |
| framework mounted; rendered again (changing nothing) | 161; 252 (5)    | 161; 254 (5)  | 161; 253 (5)  | 161; 255 (5)  |
| other rendered again (changing nothing)              | 4,516 (1,748)   | 4,509 (1,761) | 4,456 (1,708) | 4,466 (1,713) |
| further steps: framework (changing nothing)          | 34 (4)          | 36 (4)        | 34 (3)        | 36 (3)        |
| further steps: other (changing nothing)              | 623 (265)       | 619 (266)     | 618 (252)     | 626 (257)     |

- **At each step that searches or clears the search** (two in the visit, two beyond it), in both engines: the filter bar renders once more, as its text changes (the visit fills the text in one event; typed, it is once per key), and changes the page; react-aria mounts 7 fewer components: the search field's, which is no longer mounted again. No other step's framework counts moved in these runs. Each run: Chromium 252, 253, 253 framework re-renders before and 254, 254, 255 after; WebKit 253 in every run before, 255 after.
- **The seed that follows the props** seeds the form again once the render with the new props is committed, and renders only the components that read a value it changed, or `initial`. A search puts the field's own text in the address, so it renders nothing more, unless the search trimmed spaces from it.
- **The features visit** is as it was: Chromium 186 calls (23 thrown away), 78 framework re-renders (3 changing nothing); WebKit 184 (22), 77 (2).

**Frames**, Chromium, untraced, two rounds alternating the two builds, three runs each: with the fix, no long frame and no interaction over 40 ms; without it, a frame of 51 ms at the first page's load and an interaction of 48 ms at a sort, each in at least one of the first round's three runs. A third set of three runs with the fix had one frame of 51 ms at the first page's load. The first load passes 50 ms now and then in both builds, and the sort's 48 ms came without the fix. The features visit, six runs of each build: no long frame, no interaction over 40 ms. Traced, the search and its clearing force no style or layout of 0.5 ms or more; in the fourth round's trace they forced 2.4 and 1.4 ms, React removing the field that held the focus.
