// What perf/cycles.mjs writes for each run (runs.json), and which runs perf/gate.mjs counts as having
// played the whole visit: plain functions of a run's per-step summary, apart from the browsers that
// produce it, so they are tested on their own (totals.test.mjs).

const add = (taken, pick) => taken.reduce((total, step) => total + pick(step), 0);

/** The counts of some of a run's steps. */
const counts = (taken) => ({
  calls: add(taken, (step) => step.calls),
  frameworkAgain: add(taken, (step) => step.framework.again),
  frameworkUnchanged: add(taken, (step) => step.framework.unchanged.length),
  misses: add(taken, (step) => (step.ok ? 0 : 1)),
  otherAgain: add(taken, (step) => step.other.again),
  otherUnchanged: add(taken, (step) => step.other.unchanged.length),
  thrown: add(taken, (step) => step.thrown),
});

/**
 * A run's totals: the visit's, without the further steps, as the gate has always read them; and the
 * further steps' apart, with how many there were (a features visit has none).
 */
export const totalsOf = (summary, steps, errors) => {
  const visit = summary.filter((_, index) => !steps[index].further);
  const further = summary.filter((_, index) => Boolean(steps[index].further));
  return { ...counts(visit), errors, further: { ...counts(further), steps: further.length } };
};

/** A run played the whole visit when no check failed, in the visit or after it, and the page had no error. */
export const played = (run) => run.errors.length === 0 && run.misses === 0 && run.further.misses === 0;
