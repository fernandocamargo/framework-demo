# Render cycles

What a visit costs in renders, measured so that a change to the framework or the app shows its price. `npm run perf` builds the app with React's profiling build, unminified (`perf/vite.config.ts`), and drives the flow in `perf/steps.mjs` through it in headless Chromium (`perf/cycles.mjs`), in the memory world. Each step acts, waits for `window.__framework.idle()`, and checks the page once.

Per step it counts:

- **calls**: every call of a framework component's render, committed or not;
- **fw**: the framework components React committed, new or again, and of those rendered again, how many changed nothing in the page;
- **plumbing**: the framework's wrappers around them;
- **other**: every other component (react-aria's, the shell's), the same way;
- **ms** and **wasted**: their render time in the profiling build, and the part that changed nothing;
- **miss**: a check that failed right after `idle()`, which would make an end-to-end test flaky.

`LABEL`, `RUNS`, `CPU` (Chromium's throttling), `ENGINE` (`chromium` or `webkit`), `DETAIL=1` (which components changed nothing, and why) and `CHROMIUM` / `WEBKIT` (browser executables) change the run. `node perf/cycles.mjs` runs again on the last build. Results go to `perf/out/<LABEL>/`.

## Baseline

Before the i18n, ACL and other layers (`a54f01e`), Chromium, one run:

| | |
|---|---|
| steps, misses | 24, 0 |
| render calls | 200 |
| framework components | 81 mounted, 135 rendered again, 38 of them changing nothing |
| other components | 4,389 rendered again, 2,201 of them changing nothing |
| render time | 128.8 ms, 32.1 ms of it changing nothing |

The costliest step is typing six keys in the editor's title: 602 react-aria components render again, 366 of them changing nothing, because the editor's render is one function of every value of the form.

## After i18n

The flow gains two steps, a switch to Brazilian Portuguese and back. Chromium, one run:

| | baseline | i18n |
|---|---|---|
| steps, misses | 24, 0 | 26, 0 |
| render calls | 200 | 235 |
| framework components rendered again (changing nothing) | 135 (38) | 171 (40) |
| other components rendered again (changing nothing) | 4,389 (2,201) | 5,594 (2,568) |
| render time (changing nothing) | 128.8 ms (32.1 ms) | 150.9 ms (36.0 ms) |

- Each switch of locale renders the 18 framework components on screen that read the locale, every one of them changing the page, in one commit; the components that read none of it do not render.
- Without the two new steps, the other components render again 4,310 times (2,034 changing nothing), fewer than the baseline's 4,389 (2,201): what the render gets now keeps the identity of every part that did not change, and a render that would get the same is not called.

## After the ACL

Every row now holds a delete link of its own (`product/remove-link`), with a rule of its own; the session reads who is signed in from the profile. Chromium, one run, the same 26 steps:

| | i18n | ACL |
|---|---|---|
| misses | 0 | 0 |
| render calls | 235 | 353 |
| framework components mounted; rendered again (changing nothing) | 82; 171 (40) | 155; 220 (48) |
| other components rendered again (changing nothing) | 5,594 (2,568) | 5,601 (2,575) |
| render time (changing nothing) | 150.9 ms (36.0 ms) | 151.9 ms (35.0 ms) |

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
