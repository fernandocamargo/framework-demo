// The network lab's controls, from the API client's settings, in the locale on screen.

export default ({ async: { default: answer }, i18n, state }) => {
  const { settings } = answer;

  const faults = [settings.latency > 0, settings.failureRate > 0, settings.force !== 0, settings.offline].filter(
    Boolean,
  ).length;

  return {
    failurePercent: Math.round(settings.failureRate * 100),
    failureText: i18n.failures.value,
    faults,
    force: String(settings.force),
    i18n,
    latency: settings.latency,
    latencyText: i18n.latency.value,
    minutes: [1, 5, 30].map((minutes) => ({ label: i18n.token.minutes({ minutes }), value: String(minutes) })),
    offline: settings.offline,
    open: state.open,
    radioName: state.context.radioName,
    toggleLabel: i18n.toggle({ faults }),
    tokenMinutes: String(settings.tokenMinutes),
  };
};
