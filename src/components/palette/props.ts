// The palette's button, its key's words, and, while it is open, what is typed and the products
// found for it. The commands themselves are a component of their own, shown only while open.

export default ({ i18n, state }) => ({
  label: i18n.open,
  open: !state.closed,
  results: state.context.results,
  searching: state.searching,
  send: state.send,
  shortcut: /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘K' : 'Ctrl K',
  text: state.context.text,
});
