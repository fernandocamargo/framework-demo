// Drives the flow in perf/steps.mjs through the build perf/vite.config.ts makes, and counts, per
// step, the render cycles it costs:
// - calls: every call of a framework component's render, and `thrown`, those React did not commit;
// - framework: the framework components React committed, new or again, and of those rendered
//   again, how many changed nothing in the page (`no change`);
// - plumbing: the framework's own wrappers around them (Component, View);
// - other: every other component (react-aria's, the shell's).
// With DETAIL=1, each group that changed nothing says which framework component it is inside of.
// It also reports a miss for each check that failed right after `idle()`.
//
//   npm run perf                      builds, then runs the flow once in Chromium
//   node perf/cycles.mjs              runs it again on the last build
//   [LABEL=name] [RUNS=3] [CPU=4] [ENGINE=chromium|webkit] [DETAIL=1] [PORT=5190] [VISIT=features]
//
// VISIT=features plays the second visit of steps.mjs instead: the report, the orders page with its
// live map, the command palette and the tour, with totals of their own.
//
// CHROMIUM and WEBKIT may name browser executables, as for the end-to-end tests. Writes
// perf/out/<LABEL>/cycles.json (every commit of the first run), summary.txt, and runs.json: each
// run's totals for the visit, which perf/gate.mjs compares with perf/baseline.json.

import { chromium, webkit } from '@playwright/test';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

import { FEATURES, STEPS as VISIT } from './steps.mjs';

const env = process.env;
const port = Number(env.PORT ?? 5190);
const runs = Number(env.RUNS ?? 1);
const cpu = Number(env.CPU ?? 1);
const engine = env.ENGINE ?? 'chromium';
const label = env.LABEL ?? 'current';
// The visit, or the second one over the pages it does not open (steps.mjs).
const features = env.VISIT === 'features';
const STEPS = features ? FEATURES : VISIT;
const here = (file) => path.join(import.meta.dirname, file);
const DIST = here('dist');
const RENDERS = new Set(['StatefulView', 'StatelessView']);
const PLUMBING = new Set(['Component', 'View']);
// The framework's wrappers carry the folder's path as their name; react-aria has a `Component` of its own.
const isPlumbing = (component) => PLUMBING.has(component.fn) && component.name !== component.fn;
const recorder = readFileSync(here('recorder.js'), 'utf8');
const BASEMAP = /^https:\/\/(tiles\.openfreemap\.org\/styles\/|api\.maptiler\.com\/maps\/)/;
const EMPTY_STYLE = JSON.stringify({ layers: [], sources: {}, version: 8 });

if (!existsSync(path.join(DIST, 'index.html')))
  throw new Error('No perf build: run `npm run perf`, or `npx vite build --config perf/vite.config.ts`');

const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(port, resolve));
const base = `http://localhost:${port}`;

async function run() {
  const type = engine === 'webkit' ? webkit : chromium;
  const executablePath = engine === 'webkit' ? env.WEBKIT : env.CHROMIUM;
  const browser = await type.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { height: 1000, width: 1400 } });
  page.setDefaultTimeout(10_000);
  // The memory world needs no network; pictures and fonts from elsewhere are left out.
  // The live map's basemap is the one thing the app asks elsewhere for: it gets a style with nothing in it.
  await page.route(
    (url) => url.hostname !== 'localhost',
    (route) =>
      BASEMAP.test(route.request().url())
        ? route.fulfill({ body: EMPTY_STYLE, contentType: 'application/json' })
        : route.abort(),
  );
  await page.addInitScript(recorder);
  if (cpu > 1 && engine === 'chromium')
    await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const results = [];
  for (const step of STEPS) {
    await page.evaluate((name) => (window.__phase = name), step.name).catch(() => undefined);
    // A navigation starts a new document, whose recorder starts the phase at 'load'.
    await page.addInitScript((name) => (window.__phase = name), step.name);
    const started = Date.now();
    await step.act(page, base);
    await page.waitForFunction(() => Boolean(window.__framework?.idle));
    await page.evaluate(() => window.__framework.idle());
    const idleAt = Date.now() - started;
    const ok = await step.check(page).catch(() => false);
    results.push({ idleAt, name: step.name, ok });
  }
  await page.waitForTimeout(300);
  // Both at once: a commit between two reads would leave its calls without it.
  const { calls, commits } = await page.evaluate(() => ({ calls: window.__calls, commits: window.__renders }));
  await browser.close();
  return { calls, commits, errors, results };
}

const summarize = ({ calls, commits, results }) =>
  results.map((step) => {
    const components = commits.filter((commit) => commit.phase === step.name).flatMap((commit) => commit.components);
    const count = (filter) => {
      const list = components.filter(filter);
      const again = list.filter((component) => !component.mounted);
      return {
        again: again.length,
        mounted: list.length - again.length,
        unchanged: again.filter((component) => !component.dom),
      };
    };
    return {
      ...step,
      calls: calls.filter((call) => call.phase === step.name && !call.suspend).length,
      commits: commits.filter((commit) => commit.phase === step.name).length,
      framework: count((component) => RENDERS.has(component.fn)),
      other: count((component) => !RENDERS.has(component.fn) && !isPlumbing(component)),
      plumbing: count(isPlumbing),
      suspends: calls.filter((call) => call.phase === step.name && call.suspend).length,
      thrown: calls.filter((call) => call.phase === step.name && !call.suspend && !call.kept).length,
      time: components.reduce((sum, component) => sum + component.self, 0),
      wasted: components
        .filter((component) => !component.mounted && !component.dom)
        .reduce((sum, component) => sum + component.self, 0),
    };
  });

const all = [];
try {
  for (let index = 0; index < runs; index++) all.push(await run());
} finally {
  server.close();
}
mkdirSync(here(`out/${label}`), { recursive: true });
writeFileSync(here(`out/${label}/cycles.json`), JSON.stringify(all[0], null, 1));

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const summaries = all.map(summarize);
const lines = [];
const say = (line) => {
  lines.push(line);
  console.log(line);
};
say(`## ${label}: ${engine}, CPU x${cpu}, ${runs} run(s); counts from the first run`);
say(
  'step                            idle ms  miss  calls thrown | fw new again no-change | plumbing again no-change | other new again no-change |  ms  wasted',
);
const blank = () => ({
  calls: 0,
  fwAgain: 0,
  fwNew: 0,
  fwUnchanged: 0,
  misses: 0,
  otherAgain: 0,
  otherUnchanged: 0,
  steps: 0,
  thrown: 0,
  time: 0,
  wasted: 0,
});
// The visit's steps and the further ones are totalled apart.
const visit = blank();
const further = blank();
const cell = (value, width) => String(value).padStart(width);
summaries[0].forEach((step, index) => {
  const misses = summaries.filter((summary) => !summary[index].ok).length;
  const totals = STEPS[index].further ? further : visit;
  totals.steps += 1;
  totals.calls += step.calls;
  totals.thrown += step.thrown;
  totals.fwNew += step.framework.mounted;
  totals.fwAgain += step.framework.again;
  totals.fwUnchanged += step.framework.unchanged.length;
  totals.otherAgain += step.other.again;
  totals.otherUnchanged += step.other.unchanged.length;
  totals.misses += misses;
  totals.time += step.time;
  totals.wasted += step.wasted;
  say(
    `${step.name.padEnd(31)} ${cell(median(summaries.map((summary) => summary[index].idleAt)), 7)} ${cell(`${misses}/${runs}`, 5)} ${cell(step.calls, 6)} ${cell(step.thrown, 6)} |` +
      ` ${cell(step.framework.mounted, 6)} ${cell(step.framework.again, 5)} ${cell(step.framework.unchanged.length, 9)} |` +
      ` ${cell(step.plumbing.again, 14)} ${cell(step.plumbing.unchanged.length, 9)} |` +
      ` ${cell(step.other.mounted, 9)} ${cell(step.other.again, 5)} ${cell(step.other.unchanged.length, 9)} |` +
      ` ${cell(step.time.toFixed(1), 5)} ${cell(step.wasted.toFixed(1), 7)}`,
  );
  if (env.DETAIL === '1') {
    const byName = new Map();
    for (const component of [...step.framework.unchanged, ...step.other.unchanged]) {
      const cause =
        component.why?.cause === 'props'
          ? `props ${component.why.changed.map((change) => `${change.key}${change.sameValue ? '≈' : ''}`).join(',')}`
          : component.why?.cause === 'own'
            ? `own${component.why.hooks?.length ? ` hooks ${component.why.hooks.join(',')}` : ''}${component.why.contexts?.length ? ` contexts ${component.why.contexts.join(',')}` : ''}`
            : component.why?.cause;
      const key = `${RENDERS.has(component.fn) ? '' : `  (in ${(component.within || 'the shell').replace('components/', '')}) `}${component.name} ← ${cause}`;
      byName.set(key, (byName.get(key) ?? 0) + 1);
    }
    for (const [key, value] of [...byName].sort((a, b) => b[1] - a[1]).slice(0, Number(env.TOP ?? 8)))
      say(`      ${String(value).padStart(4)}× ${key}`);
  }
});
const total = (name, totals) =>
  say(
    `${name}: ${totals.steps} steps, ${totals.misses} misses; ${totals.calls} render calls, ${totals.thrown} of them thrown away; framework mounted ${totals.fwNew}, rendered again ${totals.fwAgain}, ${totals.fwUnchanged} with no change; ` +
      `other rendered again ${totals.otherAgain}, ${totals.otherUnchanged} with no change; render time ${totals.time.toFixed(1)} ms, ${totals.wasted.toFixed(1)} ms of it changing nothing`,
  );
total(features ? 'features' : 'total', visit);
if (further.steps) total('further', further);
// Counts move a little from one run of a build to the next (which of react-aria's commits fall in a
// wait, which step a late commit lands in): the visit's totals of every run, for telling a change from that.
if (runs > 1) {
  const each = (pick) =>
    summaries
      .map((summary) => summary.filter((_, index) => !STEPS[index].further).reduce((sum, step) => sum + pick(step), 0))
      .join(', ');
  say(
    `each run's visit: render calls ${each((step) => step.calls)}; thrown away ${each((step) => step.thrown)}; framework rendered again ${each((step) => step.framework.again)}, with no change ${each((step) => step.framework.unchanged.length)}; other rendered again ${each((step) => step.other.again)}, with no change ${each((step) => step.other.unchanged.length)}`,
  );
}
// Each run's totals for the visit, without the further steps, as numbers: what the gate reads.
const sum = (summary, pick) =>
  summary.filter((_, index) => !STEPS[index].further).reduce((total, step) => total + pick(step), 0);
writeFileSync(
  here(`out/${label}/runs.json`),
  `${JSON.stringify(
    summaries.map((summary, index) => ({
      calls: sum(summary, (step) => step.calls),
      errors: all[index].errors,
      frameworkAgain: sum(summary, (step) => step.framework.again),
      frameworkUnchanged: sum(summary, (step) => step.framework.unchanged.length),
      misses: sum(summary, (step) => (step.ok ? 0 : 1)),
      otherAgain: sum(summary, (step) => step.other.again),
      otherUnchanged: sum(summary, (step) => step.other.unchanged.length),
      thrown: sum(summary, (step) => step.thrown),
    })),
    null,
    1,
  )}\n`,
);
if (all.some((run) => run.errors.length))
  say(`page errors: ${[...new Set(all.flatMap((run) => run.errors))].join(' | ')}`);
writeFileSync(here(`out/${label}/summary.txt`), `${lines.join('\n')}\n`);
