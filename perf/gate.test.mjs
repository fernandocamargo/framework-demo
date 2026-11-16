import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));

test('Firefox plays before calibration, keeps failures, and gains thresholds from measured runs', (t) => {
  mkdirSync(path.join(import.meta.dirname, 'out'), { recursive: true });
  const directory = mkdtempSync(path.join(import.meta.dirname, 'out/firefox-gate-test-'));
  t.after(() => rmSync(directory, { force: true, recursive: true }));

  for (const file of ['gate.mjs', 'evidence.mjs', 'totals.mjs', 'baseline.json'])
    copyFileSync(path.join(import.meta.dirname, file), path.join(directory, file));

  const baseline = path.join(directory, 'baseline.json');
  const baselines = read(baseline);

  for (const engine of ['chromium', 'webkit'])
    for (const visit of Object.values(baselines[process.platform][engine]))
      Object.assign(visit, { frameworkAgain: 10, frameworkUnchanged: 2 });

  baselines[process.platform].firefox = {
    features: { frameworkAgain: null, frameworkUnchanged: null },
    visit: { frameworkAgain: null, frameworkUnchanged: null },
  };
  writeFileSync(baseline, JSON.stringify(baselines));

  // Recorded totals stand in for a browser visit so the gate can be checked without launching one.
  writeFileSync(
    path.join(directory, 'cycles.mjs'),
    `import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const directory = new URL('out/' + process.env.LABEL + '/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('runs.json', directory), readFileSync(new URL('run.json', import.meta.url)));
`,
  );

  const run = {
    errors: [],
    frameworkAgain: 1,
    frameworkUnchanged: 1,
    further: { misses: 0, steps: 0 },
    misses: 0,
    otherAgain: 0,
    otherUnchanged: 0,
    thrown: 0,
  };

  const record = () => writeFileSync(path.join(directory, 'run.json'), JSON.stringify([run]));

  const gate = (engine = '', ...args) =>
    spawnSync(process.execPath, [path.join(directory, 'gate.mjs'), '--no-build', ...args], {
      encoding: 'utf8',
      env: { ...process.env, ENGINE: engine, RUNS: '1' },
    });

  record();
  const pending = gate();
  assert.equal(pending.status, 0, pending.stdout + pending.stderr);
  assert.match(pending.stdout, new RegExp(`No Firefox figures yet for ${process.platform}, visit`));
  assert.match(pending.stdout, new RegExp(`No Firefox figures yet for ${process.platform}, features`));

  for (const engine of ['chromium', 'firefox', 'webkit'])
    for (const visit of ['visit', 'features']) {
      const played = read(path.join(directory, `out/gate-${engine}-${visit}/runs.json`));
      assert.deepEqual(played, [run]);
    }

  for (const failed of [{ errors: ['page error'] }, { misses: 1 }, { further: { misses: 1, steps: 1 } }]) {
    const before = { ...run };
    Object.assign(run, failed);
    record();
    const rejected = gate('firefox');
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /no run of 1 played the whole visit/);
    Object.assign(run, before);
  }

  record();
  const before = read(baseline);
  const written = gate('firefox', '--write');
  assert.equal(written.status, 0, written.stdout + written.stderr);
  const after = read(baseline);
  assert.deepEqual(after[process.platform].firefox, {
    features: { frameworkAgain: 1, frameworkUnchanged: 1 },
    visit: { frameworkAgain: 1, frameworkUnchanged: 1 },
  });
  before[process.platform].firefox = after[process.platform].firefox;
  assert.deepEqual(after, before);

  run.frameworkAgain = 2;
  record();
  const grown = gate('firefox');
  assert.equal(grown.status, 1);
  assert.match(grown.stderr, /firefox, visit: framework rendered again 1 → 2/);
  assert.match(grown.stderr, /firefox, features: framework rendered again 1 → 2/);
});
