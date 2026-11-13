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
