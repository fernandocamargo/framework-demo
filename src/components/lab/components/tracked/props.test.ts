import { intlOf, messagesOf } from 'framework/testing';

import * as messages from './i18n';
import portuguese from './i18n/pt-BR.json';
import trackedProps from './props';

test.each(['en', 'pt-BR'])('the inspector labels a cancelled write in %s', (locale) => {
  const i18n = messagesOf(messages, locale, locale === 'pt-BR' ? portuguese : {}, 'components/lab/components/tracked');

  // SAFETY: The fixture supplies every input the inspector's props read.
  const result = trackedProps({
    i18n,
    intl: intlOf(locale),
    state: {
      context: {
        entries: [
          { at: 0, event: { action: 'write', id: 1, kind: 'data', ms: 12, outcome: 'cancelled', path: 'demo.save' } },
        ],
      },
    },
  } as never);

  expect(result.entries[0]).toMatchObject({
    status: 'https://schema.org/PotentialActionStatus',
    text: 'demo.save',
    where: locale === 'pt-BR' ? 'cancelada, 12 ms' : 'cancelled, 12 ms',
  });
});
