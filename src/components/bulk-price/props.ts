// What the wizard's render shows at each step, worked out from the flow and the form, in the
// locale on screen. Prices are formatted by `intl`; the sentences that name the rule are functions
// the render gives the element for it to.

import type { ReactNode } from 'react';

import { CURRENCY } from '@/format';

import { newPrice, ruleProblem } from './rule';
import { STEP } from './state';

const STEPS = ['products', 'rule', 'preview', 'apply', 'summary'] as const;

export default ({ acl, async: { default: categories }, flags, form, i18n, intl, state }) => {
  const { context } = state;
  const { values } = form;
  const rule = form.payload();
  const money = (amount: number) => intl.formatNumber(amount, { currency: CURRENCY, style: 'currency' });
  const chosen = new Set<number>(values.selected);
  const selected = context.items.filter((item) => chosen.has(item.id));
  // The flow says which step each of its states belongs to (state.ts).
  const step = Math.max(
    ...(Object.keys(STEP) as (keyof typeof STEP)[]).filter((name) => state[name]).map((name) => STEP[name]),
  );
  const failed = context.results.filter((result) => result.error !== null);
  const total = context.results.length + context.queue.length;
  const ruleText = i18n.rule.text({ direction: rule.direction, percent: rule.percent });
  const problem = ruleProblem(rule);
  return {
    /** The rule, with what marks it: `applies(change)`, in the preview and the question. */
    applies: (marked: (chunks: ReactNode[]) => ReactNode) =>
      i18n.preview.applies({ change: marked, count: context.items.length, rule: ruleText, selected: selected.length }),
    applyText: i18n.preview.apply({ count: selected.length }),
    canApply: acl.allowed,
    categories: [{ name: i18n.choose.all, slug: '' }, ...categories],
    current: context.queue[0] ? i18n.progress.saving({ title: context.queue[0].title }) : null,
    failedCount: failed.length,
    i18n,
    items: context.items.map((item) => ({
      id: item.id,
      price: { text: money(item.price), value: item.price },
      title: item.title,
    })),
    largeText: (marked: (chunks: ReactNode[]) => ReactNode) =>
      i18n.large.text({ change: marked, count: selected.length, rule: ruleText }),
    largeTitle: i18n.large.title({ limit: flags.largeChangeAt }),
    // Why not, for a person signed in whom the rule refuses.
    limitText: acl.allowed
      ? null
      : acl.grants.prices.includes('update')
        ? i18n.limits.over({ limit: acl.limits.priceChange ?? 0 })
        : i18n.limits.none,
    loadError: context.error,
    preview: selected.map((item) => ({
      from: money(item.price),
      id: item.id,
      title: item.title,
      to: money(newPrice(item.price, rule)),
    })),
    progress: {
      text: i18n.progress.done({ done: context.results.length, total }),
      total,
      value: context.results.length,
    },
    results: context.results.map((result) => ({ ...result, from: money(result.from), to: money(result.to) })),
    retryText: i18n.retryFailed({ count: failed.length }),
    ruleProblem: problem ? i18n.problems[problem] : null,
    selectedIds: values.selected.map(String),
    selectionText: i18n.choose.selected({ count: context.items.length, selected: values.selected.length }),
    state,
    step,
    steps: STEPS.map((name, index) => ({
      current: index + 1 === step,
      done: index + 1 < step,
      label: i18n.steps[name],
    })),
    stepText: i18n.step({ count: STEPS.length, label: i18n.steps[STEPS[step - 1] ?? 'products'], step }),
    summaryText: i18n.summary({ changed: context.results.length - failed.length, failed: failed.length }),
    values,
  };
};
