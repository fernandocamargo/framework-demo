const STATUS = {
  failed: 'https://schema.org/FailedActionStatus',
  fault: 'https://schema.org/ActiveActionStatus',
  refresh: 'https://schema.org/ActiveActionStatus',
  request: 'https://schema.org/CompletedActionStatus',
  retry: 'https://schema.org/ActiveActionStatus',
} as const;

export default ({ i18n, intl, state }) => ({
  entries: state.context.entries.map((entry) => ({
    ...entry,
    kind: i18n.kinds[entry.kind],
    status: STATUS[entry.kind],
    when: intl.formatTime(entry.at, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  })),
  label: i18n.label,
  none: i18n.none,
});
