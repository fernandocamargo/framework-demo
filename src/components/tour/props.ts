import type { Settings } from '@/address';

export type Props = Pick<Settings, 'lang' | 'skin'>;
// What the tour's panel shows: the step on screen, its place among the steps, its words in the
// locale on screen, and the moves the flow allows from it.

import { STEPS } from './state';

export default ({ i18n, state }) => {
  const current = STEPS.find((name) => state[name]);
  const index = current ? STEPS.indexOf(current) + 1 : 0;
  const step = current ? i18n.steps[current] : null;
  const { error, remote } = state.context;
  return {
    back: i18n.back,
    canBack: state.can({ type: 'back' }),
    canNext: state.can({ type: 'next' }),
    close: i18n.close,
    count: STEPS.length,
    error: error === null ? null : i18n.failed({ message: error }),
    heading: i18n.title,
    index,
    label: i18n.open,
    next: current === 'finished' ? i18n.finish : i18n.next,
    open: !state.closed,
    progress: i18n.progress({ count: STEPS.length, index }),
    text: current === 'flag' && remote ? i18n.remote : (step?.text ?? ''),
    title: step?.title ?? '',
  };
};

export const examples = { 'The tour': { props: { lang: '', skin: 'default' } } };
