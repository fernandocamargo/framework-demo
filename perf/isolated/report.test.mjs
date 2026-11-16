import assert from 'node:assert/strict';
import { test } from 'node:test';

import { INTERACTIONS, summarize, table, VARIANTS } from './report.mjs';

test('counts every committed component, but only unchanged re-renders as no change', () => {
  const result = summarize(
    [
      { components: [{ dom: false, mounted: false, name: 'Outside' }], phase: 'load' },
      {
        components: [
          { dom: false, mounted: true, name: 'Mounted' },
          { dom: true, mounted: false, name: 'Changed' },
          { dom: false, mounted: false, name: 'Select', why: { cause: 'parent' } },
          {
            dom: false,
            mounted: false,
            name: 'Select',
            why: { cause: 'props', changed: [{ key: 'items', sameValue: true }] },
          },
          { dom: false, mounted: false, name: 'Input', why: { cause: 'own', contexts: ['Search'], hooks: [2] } },
        ],
        phase: 'choose sort',
      },
    ],
    'choose sort',
  );
  assert.equal(result.renders, 5);
  assert.equal(result.mounted, 1);
  assert.equal(result.unchanged, 3);
  assert.equal(result.names[0].name, 'Select');
  assert.equal(result.names[0].count, 2);
  assert.equal(result.names[0].causes['props: items (equal value, new identity)'], 1);
  assert.equal(result.names[1].causes['own: hooks [2], contexts [Search]'], 1);
});

test('the table compares the same interactions and refuses missing measurements', () => {
  const results = VARIANTS.flatMap((variant) =>
    INTERACTIONS.map((interaction) => ({
      interaction,
      mounted: 1,
      names: [],
      renders: 12,
      unchanged: 3,
      variant,
    })),
  );
  const printed = table('chromium', results);
  assert.match(printed, /chromium: committed renders/);
  assert.equal(printed.match(/12 \(3\)/g).length, 15);
  assert.throws(() => table('webkit', results.slice(1)), /Missing webkit\/aria-docs/);
});
