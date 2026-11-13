// The network lab's controls, from the API client's settings, and its two activity lists.
import { time } from '@/format'

const TONES = { request: 'ok', retry: 'warn', refresh: 'accent', fault: 'warn', failed: 'danger', interaction: 'accent', failure: 'danger' } as const

export default ({ state, async: { default: answer, change, expireToken, breakRefresh, forgetChanges, sellOut } }) => {
  const { settings, editing } = answer
  const faults = [settings.latency > 0, settings.failureRate > 0, settings.force !== 0, settings.offline].filter(Boolean).length
  return {
    open: state.open,
    send: state.send,
    change,
    expireToken,
    breakRefresh,
    forgetChanges,
    sellOut,
    faults,
    toggleLabel: faults ? `Network lab, ${faults} fault${faults === 1 ? '' : 's'} on` : 'Network lab',
    latency: settings.latency,
    failurePercent: Math.round(settings.failureRate * 100),
    force: String(settings.force),
    offline: settings.offline,
    tokenMinutes: String(settings.tokenMinutes),
    canSellOut: editing !== null,
    network: state.context.network.map((entry) => ({ ...entry, tone: TONES[entry.kind], when: time(entry.at) })),
    tracked: state.context.tracked.map((entry) => ({ ...entry, tone: TONES[entry.kind], when: time(entry.at) })),
  }
}
