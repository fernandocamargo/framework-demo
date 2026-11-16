// The header button and whether its dialog is open.

export default ({ i18n, state }) => ({
  label: i18n.open,
  open: state.open,
  shortcut: /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘K' : 'Ctrl K',
});
