import assert from 'node:assert/strict';
import { test } from 'node:test';

import { played, totalsOf } from './totals.mjs';

/** One step's summary, as perf/cycles.mjs makes it. */
const step = ({ again = 0, calls = 0, ok = true, other = 0, otherUnchanged = 0, thrown = 0, unchanged = 0 }) => ({
  calls,
  framework: { again, unchanged: Array.from({ length: unchanged }) },
  ok,
  other: { again: other, unchanged: Array.from({ length: otherUnchanged }) },
  thrown,
});
const steps = [{ name: 'open' }, { name: 'search' }, { further: true, name: 'lab' }, { further: true, name: 'back' }];
const summary = [
  step({ again: 2, calls: 3, other: 10, otherUnchanged: 4, thrown: 1, unchanged: 1 }),
  step({ again: 1, calls: 1, other: 5 }),
  step({ again: 4, calls: 4, other: 300, otherUnchanged: 270, thrown: 2, unchanged: 2 }),
  step({ calls: 1, other: 7, otherUnchanged: 3 }),
];

test("a run's visit totals leave the further steps out, as the gate has always read them", () => {
  const { further, ...visit } = totalsOf(summary, steps, []);
  assert.deepEqual(visit, {
    calls: 4,
    errors: [],
    frameworkAgain: 3,
    frameworkUnchanged: 1,
    misses: 0,
    otherAgain: 15,
    otherUnchanged: 4,
    thrown: 1,
  });
  assert.deepEqual(further, {
    calls: 5,
    frameworkAgain: 4,
    frameworkUnchanged: 2,
    misses: 0,
    otherAgain: 307,
    otherUnchanged: 273,
    steps: 2,
    thrown: 2,
  });
});

test('a visit with no further steps has empty further totals', () => {
  const { further } = totalsOf(summary.slice(0, 2), steps.slice(0, 2), []);
  assert.equal(further.steps, 0);
  assert.equal(further.calls, 0);
});

test('a run that failed a check after the visit, and only there, did not play the whole visit', () => {
  const failedLate = summary.map((each, index) => (index === 3 ? { ...each, ok: false } : each));
  const run = totalsOf(failedLate, steps, []);
  assert.equal(run.misses, 0);
  assert.equal(run.further.misses, 1);
  assert.equal(played(run), false);
});

test('a run plays the whole visit only with every check passed and no page error', () => {
  assert.equal(played(totalsOf(summary, steps, [])), true);
  assert.equal(played(totalsOf(summary, steps, ['TypeError: boom'])), false);
  const failedEarly = summary.map((each, index) => (index === 0 ? { ...each, ok: false } : each));
  assert.equal(played(totalsOf(failedEarly, steps, [])), false);
});
