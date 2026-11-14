// The tour's keys: `t` starts it, `.` and `,` move it on and back. Each works only while the chart
// takes its event, so `.` does nothing while the tour is closed.
export default ({ i18n }) => ({
  '.': { label: i18n.keys.next, send: 'next' },
  ',': { label: i18n.keys.back, send: 'back' },
  t: { label: i18n.keys.start, send: 'start' },
});
