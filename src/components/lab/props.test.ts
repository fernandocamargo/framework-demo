import { intlOf, messagesOf } from 'framework/testing';

import * as messages from './i18n';
import portuguese from './i18n/pt-BR.json';
import labProps from './props';

test.each(['en', 'pt-BR'])('the inspector labels a cancelled write in %s', (locale) => {
  const i18n = messagesOf(messages, locale, locale === 'pt-BR' ? portuguese : {}, 'components/lab');

  // SAFETY: The fixture supplies every input the lab's props read.
  const result = labProps({
    async: { default: { settings: { failureRate: 0, force: 0, latency: 0, offline: false, tokenMinutes: 1 } } },
    i18n,
    intl: intlOf(locale),
    state: {
      context: {
        network: [],
        tracked: [
          { at: 0, event: { action: 'write', id: 1, kind: 'data', ms: 12, outcome: 'cancelled', path: 'demo.save' } },
        ],
      },
      open: true,
    },
  } as never);

  expect(result.tracked[0]).toMatchObject({
    kind: i18n.kinds.write,
    status: 'https://schema.org/PotentialActionStatus',
    text: 'demo.save',
    where: locale === 'pt-BR' ? 'cancelada, 12 ms' : 'cancelled, 12 ms',
  });
});
