// Fails when the framework's re-renders grow. Builds the perf build, plays both visits of
// perf/steps.mjs in Chromium and in WebKit (perf/cycles.mjs), and compares, per engine and visit,
// with perf/baseline.json:
// - the framework components rendered again, and those of them that changed nothing in the page:
//   more than the baseline fails;
// - react-aria's and the shell's re-renders, and the renders React threw away: reported only. They
//   move with timing from one run to the next.
// The figure is the least of the runs. A run's count is never under what the code costs: timing
// only adds to it (a commit that lands apart from another: one render more in one run in five on
// a quiet machine, one to three more in most runs on a busy one). So a visit is played until its
// least figures are within the baseline, RUNS times at most: once on a quiet machine. Code that
// renders more stays over the baseline in every run, and fails after RUNS of them. Writing the
// baseline plays every visit five times.
// A run with a failed check or a page error did not play the whole visit, and is left out; a
// visit with no clean run fails.
//
//   npm run perf:gate                 compares with the baseline
//   npm run perf:baseline             writes the baseline (perf/README.md says when)
//   [RUNS=10] [PORT=5190] [CHROMIUM=…] [WEBKIT=…]
//   node perf/gate.mjs --no-build     compares the last perf build

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const here = (file) => path.join(import.meta.dirname, file);
const root = path.join(import.meta.dirname, '..');
const BASELINE = here('baseline.json');
const ENGINES = ['chromium', 'webkit'];
const VISITS = ['visit', 'features'];
// What fails the gate when it grows, and what is only reported.
const GATED = { frameworkAgain: 'framework rendered again', frameworkUnchanged: 'with no change' };
const REPORTED = { otherAgain: 'other rendered again', otherUnchanged: 'with no change', thrown: 'thrown away' };
const write = process.argv.includes('--write');
const runs = Number(process.env.RUNS ?? (write ? 5 : 10));
const started = Date.now();

const node = (args, env = {}) =>
  spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });
const clean = (run) => run.misses === 0 && run.errors.length === 0;
const fail = (message, output = '') => {
  console.error(`${output}\n${message}`.trim());
  process.exit(1);
};

if (!process.argv.includes('--no-build')) {
  const vite = path.join(root, 'node_modules/vite/bin/vite.js');
  const built = node([vite, 'build', '--config', 'perf/vite.config.ts', '--logLevel', 'warn']);
  if (built.status !== 0) fail('The perf build failed.', built.stdout + built.stderr);
}

const least = (clean, key) => Math.min(...clean.map((run) => run[key]));
// One baseline per platform: fonts and timers differ between them (WebKit on Linux renders a component
// or two more in the visit than on macOS), and each is compared with its own.
const PLATFORM = process.platform;
const baselines = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const baseline = baselines[PLATFORM];
if (!write && !baseline)
  fail(`No baseline for ${PLATFORM} in perf/baseline.json: \`npm run perf:baseline\` writes it.`);
const measured = {};
for (const engine of ENGINES) {
  measured[engine] = {};
  for (const visit of VISITS) {
    const label = `gate-${engine}-${visit}`;
    const within = (clean) =>
      clean.length > 0 && Object.keys(GATED).every((key) => least(clean, key) <= baseline?.[engine]?.[visit]?.[key]);
    const all = [];
    let output = '';
    // One run at a time: when comparing, the first that brings the figures within the baseline is the last.
    while (all.length < runs && (write || !within(all.filter(clean)))) {
      const played = node([here('cycles.mjs')], {
        DETAIL: '',
        ENGINE: engine,
        LABEL: label,
        RUNS: '1',
        VISIT: visit === 'features' ? 'features' : '',
      });
      output = played.stdout + played.stderr;
      if (played.status !== 0) fail(`${engine}, ${visit}: the visit did not run.`, output);
      all.push(...JSON.parse(readFileSync(here(`out/${label}/runs.json`), 'utf8')));
    }
    const whole = all.filter(clean);
    if (!whole.length)
      fail(
        `${engine}, ${visit}: no run of ${all.length} played the whole visit (a failed check or a page error).`,
        output,
      );
    const figures = Object.fromEntries(Object.keys({ ...GATED, ...REPORTED }).map((key) => [key, least(whole, key)]));
    measured[engine][visit] = figures;
    const each = (key) => (all.length > 1 ? ` (${all.map((run) => run[key]).join(', ')})` : '');
    const list = (names) =>
      Object.entries(names)
        .map(([key, name]) => `${name} ${figures[key]}${each(key)}`)
        .join(', ');
    console.log(
      `${engine}, ${visit}, ${all.length} run(s): ${list(GATED)}; ${list(REPORTED)}${whole.length < all.length ? `; ${all.length - whole.length} run(s) left out` : ''}`,
    );
  }
}
const seconds = Math.round((Date.now() - started) / 1000);

if (write) {
  baselines[PLATFORM] = Object.fromEntries(
    ENGINES.map((engine) => [
      engine,
      Object.fromEntries(
        VISITS.map((visit) => [
          visit,
          Object.fromEntries(Object.keys(GATED).map((key) => [key, measured[engine][visit][key]])),
        ]),
      ),
    ]),
  );
  writeFileSync(BASELINE, `${JSON.stringify(baselines, null, 2)}\n`);
  console.log(
    `Wrote ${PLATFORM}'s figures in perf/baseline.json (${seconds} s). The commit that holds it says why they changed.`,
  );
  process.exit(0);
}

const grown = [];
const shrunk = [];
for (const engine of ENGINES)
  for (const visit of VISITS)
    for (const [key, name] of Object.entries(GATED)) {
      const before = baseline[engine]?.[visit]?.[key];
      const now = measured[engine][visit][key];
      if (before === undefined) grown.push(`${engine}, ${visit}: the baseline has no "${key}"`);
      else if (now > before) grown.push(`${engine}, ${visit}: ${name} ${before} → ${now}`);
      else if (now < before) shrunk.push(`${engine}, ${visit}: ${name} ${before} → ${now}`);
    }
if (shrunk.length)
  console.log(`Fewer than the baseline:\n  ${shrunk.join('\n  ')}\n\`npm run perf:baseline\` keeps the gain.`);
if (grown.length)
  fail(
    `The framework renders more than the baseline (perf/baseline.json):\n  ${grown.join('\n  ')}\n` +
      '`DETAIL=1 node perf/cycles.mjs` says which components, and why. If the cost is meant, ' +
      '`npm run perf:baseline`, in a commit that says why.',
  );
console.log(`The framework renders no more than the baseline (${seconds} s).`);
