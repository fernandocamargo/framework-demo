// The network lab's controls, from the API client's settings, and its two activity lists, in the
// locale on screen: the API client's requests, and the inspector, which shows what the pipelines
// carried: interactions with the place they were written, failures with their layer, and what the
// data layer did.
import type { I18n, Intl } from 'framework'
import type { Tracked } from '@/clients/tracker'
import type * as messages from './i18n'

const TONES = {
  request: 'ok',
  retry: 'warn',
  refresh: 'accent',
  fault: 'warn',
  failed: 'danger',
  interaction: 'accent',
  failure: 'danger',
  read: 'ok',
  derive: 'accent',
  write: 'accent',
  optimistic: 'accent',
  rollback: 'warn',
  stale: 'warn',
  tab: 'ok',
} as const

/** One entry of the inspector: its kind, what it was about, and what it says. */
function describe(entry: Tracked, i18n: I18n<typeof messages>, intl: Intl, causes: Map<number, string>) {
  const { event } = entry
  if (event.kind === 'interaction') return { kind: 'interaction' as const, text: `${event.site.element}.${event.site.prop}`, where: `${event.site.file}:${event.site.line}` }
  if (event.kind === 'failure')
    return { kind: 'failure' as const, text: event.error.message, where: [event.layer, event.path, event.during].filter(Boolean).join(' · ') }
  const reads = intl.formatList(event.reads ?? [])
  const ms = event.ms ?? 0
  const where = (() => {
    switch (event.action) {
      case 'read':
        return event.reads ? i18n.inspector.component({ reads, ms }) : i18n.inspector.took({ ms })
      case 'derive':
        return i18n.inspector.derived({ reads })
      case 'write': {
        if (event.outcome === 'done') return i18n.inspector.done({ ms })
        if (event.outcome === 'failed') return i18n.inspector.failed({ ms })
        const cause = event.cause === undefined ? undefined : causes.get(event.cause)
        return cause ? i18n.inspector.sentBy({ cause }) : i18n.inspector.sent
      }
      case 'optimistic':
        return i18n.inspector.shows({ reads })
      case 'rollback':
        return i18n.inspector.takesBack({ reads })
      case 'stale':
        return event.outcome === 'received'
          ? i18n.inspector.staleFromTab({ reads, by: event.path })
          : event.outcome === 'pushed'
            ? i18n.inspector.stalePushed({ reads })
            : i18n.inspector.staleBy({ reads, by: event.path })
      case 'tab':
        return event.outcome === 'received' ? i18n.inspector.fromTab({ reads }) : i18n.inspector.toTabs({ reads })
    }
  })()
  return { kind: event.action, text: event.action === 'stale' ? '' : event.path, where }
}

export default ({ state, i18n, intl, async: { default: answer, change, expireToken, breakRefresh, forgetChanges } }) => {
  const { settings } = answer
  const faults = [settings.latency > 0, settings.failureRate > 0, settings.force !== 0, settings.offline].filter(Boolean).length
  const when = (at: number) => intl.formatTime(at, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return {
    i18n,
    open: state.open,
    send: state.send,
    change,
    expireToken,
    breakRefresh,
    forgetChanges,
    faults,
    toggleLabel: i18n.toggle({ faults }),
    latency: settings.latency,
    // The messages themselves, not a function made here: the same at every run, so the sliders'
    // outputs that call them are kept (track.ts) and react-aria does not render them again.
    latencyText: i18n.latency.value,
    failurePercent: Math.round(settings.failureRate * 100),
    failureText: i18n.failures.value,
    force: String(settings.force),
    offline: settings.offline,
    tokenMinutes: String(settings.tokenMinutes),
    minutes: [1, 5, 30].map((minutes) => ({ value: String(minutes), label: i18n.token.minutes({ minutes }) })),
    network: state.context.network.map((entry) => ({ ...entry, tone: TONES[entry.kind], kind: i18n.kinds[entry.kind], when: when(entry.at) })),
    tracked: (() => {
      const tracked: Tracked[] = state.context.tracked
      // A write names the interaction that sent it, by the handler and the place it was written.
      const causes = new Map(
        tracked.flatMap(({ event }) => (event.kind === 'interaction' ? [[event.id, `${event.site.element}.${event.site.prop} (${event.site.file}:${event.site.line})`] as const] : [])),
      )
      return tracked.map((entry) => {
        const { kind, text, where } = describe(entry, i18n, intl, causes)
        return { id: entry.event.id, type: kind, tone: TONES[kind], kind: i18n.kinds[kind], text, where, when: when(entry.at) }
      })
    })(),
  }
}
