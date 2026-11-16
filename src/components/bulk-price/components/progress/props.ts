import type { AnyActorRef } from 'xstate';

import { CURRENCY } from '@/format';
import type { Listed } from '@/services/products/types';
import type { I18n, Intl } from 'framework';

import type { Result } from '../../state';

export type Props = {
  closeWizard: () => void;
  i18n: I18n<typeof import('../../i18n')>;
  intl: Intl;
  retryFailed: () => void;
  wizard: Pick<AnyActorRef, 'getSnapshot' | 'subscribe'>;
};

export default (given) => {
  const { closeWizard, i18n, intl, retryFailed } = given;

  // SAFETY: The trial runtime adds these selected fields before calling Progress's props file.
  const { queue, results, summary } = (
    given as typeof given & { status: { queue: Listed[]; results: Result[]; summary: boolean } }
  ).status;

  const failed = results.filter((result) => result.error !== null);
  const total = results.length + queue.length;

  const money = (amount: number) => intl.formatNumber(amount, { currency: CURRENCY, style: 'currency' });

  return {
    closeWizard,
    current: queue[0] ? i18n.progress.saving({ title: queue[0].title }) : null,
    failedCount: failed.length,
    i18n,
    progress: {
      text: i18n.progress.done({ done: results.length, total }),
      total,
      value: results.length,
    },
    results: results.map((result) => ({ ...result, from: money(result.from), to: money(result.to) })),
    retryFailed,
    retryText: i18n.retryFailed({ count: failed.length }),
    summary,
    summaryText: i18n.summary({ changed: results.length - failed.length, failed: failed.length }),
  };
};
