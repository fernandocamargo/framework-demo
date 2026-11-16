// Reads the first-run trace saved by cycles.mjs, without changing the visit or its counters.
// Keeps every step, including further, and every component/cause group instead of the top eight.
//   node perf/walk.mjs perf/out/<label>/cycles.json > perf/out/<label>/walk.json
//   node perf/walk.mjs --self-check

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FEATURES, STEPS } from './steps.mjs';

const isView = ({ fn, name }) => fn === 'View' && name !== fn;
const kindOf = (component) =>
  isView(component)
    ? 'framework'
    : ['Failed', 'Reporting', 'Waiting'].includes(component.fn) || component.under === 'Reporting'
      ? 'plumbing'
      : 'other';
const blank = () => ({ again: 0, mounted: 0, unchanged: 0 });
const add = (counts, component) => {
  if (component.mounted) counts.mounted++;
  else {
    counts.again++;
    if (!component.dom) counts.unchanged++;
  }
};
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);

function measure(calls, commits) {
  const counts = { framework: blank(), other: blank(), plumbing: blank() };
  const groups = new Map();
  const owners = new Map();
  for (const commit of commits) {
    const rendered = new Set(commit.components.filter(isView).map((c) => c.name));
    for (const component of commit.components) {
      const kind = kindOf(component);
      const owner = component.within || '(shell)';
      add(counts[kind], component);
      const key = JSON.stringify([kind, owner, component.name, component.why]);
      if (!groups.has(key))
        groups.set(key, { ...blank(), kind, name: component.name, owner, why: component.why ?? null });
      add(groups.get(key), component);
      if (kind !== 'other') continue;
      if (!owners.has(owner)) owners.set(owner, { ...blank(), owner, withoutOwner: 0 });
      const row = owners.get(owner);
      add(row, component);
      // A folder name is not an instance id; this partition is co-occurrence, not causation.
      if (!component.mounted && !component.dom && !rendered.has(component.within)) row.withoutOwner++;
    }
  }
  const completed = calls.filter((call) => !call.suspend);
  const thrown = completed.filter((call) => !call.kept);
  const paths = new Map();
  for (const call of calls) {
    if (!paths.has(call.path)) paths.set(call.path, { calls: 0, path: call.path, suspends: 0, thrown: 0 });
    const row = paths.get(call.path);
    if (call.suspend) row.suspends++;
    else {
      row.calls++;
      if (!call.kept) row.thrown++;
    }
  }
  assert.equal(sum([...owners.values()], 'again'), counts.other.again);
  assert.equal(sum([...owners.values()], 'unchanged'), counts.other.unchanged);
  return {
    calls: completed.length,
    commits: commits.length,
    counts,
    groups: [...groups.values()],
    owners: [...owners.values()],
    paths: [...paths.values()],
    suspends: calls.length - completed.length,
    thrown: thrown.length,
  };
}

function walk(trace) {
  const visit = trace.results.some((step) => step.name === FEATURES[0].name) ? FEATURES : STEPS;
  const names = new Set(trace.results.map((step) => step.name));
  assert.equal(names.size, trace.results.length, 'Step names must be unique within a visit');
  const measurements = (selected) =>
    measure(
      trace.calls.filter((call) => selected.has(call.phase)),
      trace.commits.filter((commit) => selected.has(commit.phase)),
    );
  const steps = trace.results.map((step) => {
    const declared = visit.find((item) => item.name === step.name);
    assert.ok(declared, `Unknown step: ${step.name}`);
    return {
      ...step,
      ...measurements(new Set([step.name])),
      section: declared.further ? 'further' : visit === FEATURES ? 'features' : 'main',
    };
  });
  const sections = [...new Set(steps.map((step) => step.section))].map((section) => {
    const selected = steps.filter((step) => step.section === section);
    const measured = measurements(new Set(selected.map((step) => step.name)));
    for (const key of ['calls', 'commits', 'suspends', 'thrown']) assert.equal(measured[key], sum(selected, key));
    for (const kind of Object.keys(measured.counts))
      for (const key of Object.keys(measured.counts[kind]))
        assert.equal(
          measured.counts[kind][key],
          sum(
            selected.map((step) => step.counts[kind]),
            key,
          ),
        );
    return { ...measured, misses: selected.filter((step) => !step.ok).length, section, steps: selected.length };
  });
  return {
    clean: trace.errors.length === 0 && trace.results.every((step) => step.ok),
    errors: trace.errors,
    outsideSteps: measure(
      trace.calls.filter((call) => !names.has(call.phase)),
      trace.commits.filter((commit) => !names.has(commit.phase)),
    ),
    sections,
    steps,
  };
}

function selfCheck() {
  const phase = STEPS[0].name;
  const further = STEPS.find((step) => step.further).name;
  const component = (fn, name = fn, within = '') => ({ dom: false, fn, mounted: false, name, within });
  const fixture = {
    calls: [
      { kept: true, path: 'folder', phase },
      { kept: false, path: 'folder', phase },
      { path: 'folder', phase, suspend: 'data' },
      { kept: false, path: 'folder', phase: further },
      { kept: false, path: 'folder', phase: 'load' },
    ],
    commits: [
      {
        components: [
          component('View', 'folder'),
          { ...component('View', 'child'), mounted: true },
          component('Reporting'),
          component('View'),
          component('Button', 'Button', 'folder'),
          { ...component('Label', 'Label', 'folder'), dom: true },
        ],
        phase,
      },
      { components: [component('Button', 'Button', 'folder')], phase: further },
    ],
    errors: [],
    results: [
      { name: phase, ok: true },
      { name: further, ok: false },
    ],
  };
  const result = walk(fixture);
  const [main, extra] = result.sections;
  assert.deepEqual(main.counts.framework, { again: 1, mounted: 1, unchanged: 1 });
  assert.deepEqual(main.counts.plumbing, { again: 1, mounted: 0, unchanged: 1 });
  assert.deepEqual(main.counts.other, { again: 3, mounted: 0, unchanged: 2 });
  assert.equal(main.calls, 2);
  assert.equal(main.thrown, 1);
  assert.equal(main.suspends, 1);
  assert.equal(main.owners.find((row) => row.owner === 'folder').withoutOwner, 0);
  assert.equal(extra.owners[0].withoutOwner, 1);
  assert.equal(extra.thrown, 1);
  assert.equal(extra.misses, 1);
  assert.equal(result.clean, false);
  assert.equal(result.outsideSteps.thrown, 1);
  fixture.results = [{ name: FEATURES[0].name, ok: true }];
  assert.equal(walk(fixture).sections[0].section, 'features');
  console.log('The walk keeps mounts, updates, discarded calls, further failures and unassigned work apart.');
}

const [file] = process.argv.slice(2);
if (file === '--self-check') selfCheck();
else {
  assert.ok(file, 'Pass cycles.json, or --self-check');
  console.log(JSON.stringify(walk(JSON.parse(readFileSync(file, 'utf8'))), null, 2));
}
