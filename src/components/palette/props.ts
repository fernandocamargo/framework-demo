// The header button, whether its dialog is open, and the name the dialog and its menu share.

export default ({ i18n, state }) => ({
  label: i18n.open,
  open: state.open,
  shortcut: /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘K' : 'Ctrl K',
  title: i18n.title,
});
