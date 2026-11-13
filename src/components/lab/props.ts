// The network lab's controls, from the API client's settings, and its two activity lists, in the
// locale on screen.
const TONES = { request: 'ok', retry: 'warn', refresh: 'accent', fault: 'warn', failed: 'danger', interaction: 'accent', failure: 'danger' } as const

export default ({ state, i18n, intl, async: { default: answer, change, expireToken, breakRefresh, forgetChanges, sellOut } }) => {
  const { settings, editing } = answer
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
    sellOut,
    faults,
    toggleLabel: i18n.toggle({ faults }),
    latency: settings.latency,
    latencyText: (ms: number) => i18n.latency.value({ ms }),
    failurePercent: Math.round(settings.failureRate * 100),
    failureText: (percent: number) => i18n.failures.value({ percent }),
    force: String(settings.force),
    offline: settings.offline,
    tokenMinutes: String(settings.tokenMinutes),
    minutes: [1, 5, 30].map((minutes) => ({ value: String(minutes), label: i18n.token.minutes({ minutes }) })),
    canSellOut: editing !== null,
    network: state.context.network.map((entry) => ({ ...entry, tone: TONES[entry.kind], kind: i18n.kinds[entry.kind], when: when(entry.at) })),
    tracked: state.context.tracked.map((entry) => ({ ...entry, type: entry.kind, tone: TONES[entry.kind], kind: i18n.kinds[entry.kind], when: when(entry.at) })),
  }
}
