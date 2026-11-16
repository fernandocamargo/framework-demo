import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { totalsOf } from './totals.mjs';

export const gateLabel = (engine, visit, ordinal) => `gate-${engine}-${visit}${ordinal === 1 ? '' : `-${ordinal}`}`;

export const writeEvidence = (directory, traces, summaries, steps) => {
  mkdirSync(directory, { recursive: true });

  const runs = summaries.map((summary, index) => {
    const ordinal = index + 1;
    const trace = ordinal === 1 ? 'cycles.json' : `cycles-${ordinal}.json`;

    writeFileSync(path.join(directory, trace), JSON.stringify(traces[index], null, 1));

    return { ...totalsOf(summary, steps, traces[index].errors), ordinal, trace };
  });

  writeFileSync(path.join(directory, 'runs.json'), `${JSON.stringify(runs, null, 1)}\n`);
};
