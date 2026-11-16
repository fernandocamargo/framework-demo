import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { gateLabel, writeEvidence } from './evidence.mjs';
import { STEPS } from './steps.mjs';
import { totalsOf } from './totals.mjs';

const steps = [STEPS[0], STEPS[1], STEPS.find((step) => step.further)];
const names = steps.map((step) => step.name);
const component = { dom: false, fn: 'Button', mounted: false, name: 'Button', within: 'components/app' };

const trace = (first) => ({
  calls: [
    ...Array.from({ length: 2 }, () => ({ kept: true, path: 'components/app', phase: names[first] })),
    { kept: false, path: 'components/app', phase: 'load' },
  ],
  commits: [
    { components: [component], phase: names[first] },
    { components: [], phase: names[1 - first] },
  ],
  errors: ['page error'],
  results: names.map((name, index) => ({ name, ok: index !== 2 })),
});

const summary = (first) =>
  names.map((name, index) => ({
    calls: index === first ? 2 : 0,
    framework: { again: 0, unchanged: [] },
    ok: index !== 2,
    other: { again: index === first ? 1 : 0, unchanged: index === first ? [component] : [] },
    thrown: 0,
  }));

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const walk = (file) => JSON.parse(execFileSync(process.execPath, [path.join(import.meta.dirname, 'walk.mjs'), file]));

test('each ordinal keeps its own walkable trace, including failures and events outside steps', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'perf-evidence-'));
  const traces = [trace(0), trace(1)];

  try {
    writeEvidence(directory, traces.slice(0, 1), [summary(0)], steps);
    assert.deepEqual(read(path.join(directory, 'cycles.json')), traces[0]);

    writeEvidence(directory, traces, [summary(0), summary(1)], steps);
    const runs = read(path.join(directory, 'runs.json'));

    assert.deepEqual(
      runs.map(({ ordinal, trace, ...totals }) => [ordinal, trace, totals]),
      [
        [1, 'cycles.json', totalsOf(summary(0), steps, traces[0].errors)],
        [2, 'cycles-2.json', totalsOf(summary(1), steps, traces[1].errors)],
      ],
    );
    assert.deepEqual(totalsOf(summary(0), steps, traces[0].errors), totalsOf(summary(1), steps, traces[1].errors));
    assert.deepEqual(runs[0].calls, runs[1].calls);
    assert.deepEqual(runs[0].otherAgain, runs[1].otherAgain);
    assert.deepEqual(runs[0].further, runs[1].further);
    assert.equal(runs[0].misses, 0);
    assert.equal(runs[0].further.misses, 1);
    assert.deepEqual(runs[1].errors, ['page error']);

    for (const [index, run] of runs.entries()) {
      const file = path.join(directory, run.trace);
      assert.deepEqual(read(file), traces[index]);
      const walked = walk(file);
      assert.equal(walked.clean, false);
      assert.deepEqual(walked.errors, ['page error']);
      assert.equal(walked.sections[1].misses, 1);
      assert.equal(walked.steps[index].calls, 2);
      assert.equal(walked.steps[1 - index].commits, 1);
      assert.equal(walked.outsideSteps.calls, 1);
    }
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('gate iterations keep their earlier evidence', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'perf-gate-evidence-'));

  try {
    const first = path.join(directory, gateLabel('chromium', 'visit', 1));
    const second = path.join(directory, gateLabel('chromium', 'visit', 2));
    assert.equal(path.basename(first), 'gate-chromium-visit');
    assert.notEqual(first, second);
    writeEvidence(first, [trace(0)], [summary(0)], steps);
    writeEvidence(second, [trace(1)], [summary(1)], steps);
    assert.deepEqual(read(path.join(first, 'cycles.json')), trace(0));
    assert.deepEqual(read(path.join(second, 'cycles.json')), trace(1));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
