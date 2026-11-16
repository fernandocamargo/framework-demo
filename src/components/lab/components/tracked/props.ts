import type { Tracked } from '@/clients/tracker';
import type { I18n, Intl } from 'framework';

import type * as messages from './i18n';

const STATUS = {
  derive: 'https://schema.org/CompletedActionStatus',
  failure: 'https://schema.org/FailedActionStatus',
  interaction: 'https://schema.org/CompletedActionStatus',
  optimistic: 'https://schema.org/PotentialActionStatus',
  read: 'https://schema.org/CompletedActionStatus',
  rollback: 'https://schema.org/ActiveActionStatus',
  stale: 'https://schema.org/ActiveActionStatus',
  tab: 'https://schema.org/CompletedActionStatus',
  write: 'https://schema.org/PotentialActionStatus',
} as const;

/** One entry of the inspector: its kind, what it was about, and what it says. */
function describe(entry: Tracked, i18n: I18n<typeof messages>, intl: Intl, causes: Map<number, string>) {
  const { event } = entry;

  if (event.kind === 'interaction')
    return {
      kind: 'interaction' as const,
      text: `${event.site.element}.${event.site.prop}`,
      where: `${event.site.file}:${event.site.line}`,
    };

  if (event.kind === 'failure')
    return {
      kind: 'failure' as const,
      text: event.error.message,
      where: [event.layer, event.path, event.during].filter(Boolean).join(' · '),
    };
  const reads = intl.formatList(event.reads ?? []);
  const ms = event.ms ?? 0;

  const where = (() => {
    switch (event.action) {
      case 'derive':
        return i18n.inspector.derived({ reads });
      case 'optimistic':
        return i18n.inspector.shows({ reads });
      case 'read':
        return event.reads ? i18n.inspector.component({ ms, reads }) : i18n.inspector.took({ ms });
      case 'rollback':
        return i18n.inspector.takesBack({ reads });
      case 'stale':
        return event.outcome === 'received'
          ? i18n.inspector.staleFromTab({ by: event.path, reads })
          : event.outcome === 'pushed'
            ? i18n.inspector.stalePushed({ reads })
            : i18n.inspector.staleBy({ by: event.path, reads });
      case 'tab':
        return event.outcome === 'received' ? i18n.inspector.fromTab({ reads }) : i18n.inspector.toTabs({ reads });
      case 'write': {
        if (event.outcome === 'done') return i18n.inspector.done({ ms });

        if (event.outcome === 'failed') return i18n.inspector.failed({ ms });
        const cause = event.cause === undefined ? undefined : causes.get(event.cause);

        return cause ? i18n.inspector.sentBy({ cause }) : i18n.inspector.sent;
      }
    }
  })();

  return { kind: event.action, text: event.action === 'stale' ? '' : event.path, where };
}

export default ({ i18n, intl, state }) => {
  const tracked: Tracked[] = state.context.entries;

  const causes = new Map(
    tracked.flatMap(({ event }) =>
      event.kind === 'interaction'
        ? [[event.id, `${event.site.element}.${event.site.prop} (${event.site.file}:${event.site.line})`] as const]
        : [],
    ),
  );

  return {
    entries: tracked.map((entry) => {
      const { kind, text, where } = describe(entry, i18n, intl, causes);

      return {
        byPerson: kind === 'interaction',
        id: entry.event.id,
        kind: i18n.kinds[kind],
        status: STATUS[kind],
        text,
        when: intl.formatTime(entry.at, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        where,
      };
    }),
    label: i18n.label,
    none: i18n.none,
  };
};
