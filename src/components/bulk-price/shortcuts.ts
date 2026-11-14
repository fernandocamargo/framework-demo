// The wizard's key moves it on. In the preview it applies the change: only when the chart offers
// `apply` (the grant to update prices) and the folder's acl.ts allows this percentage.
export default ({ acl, i18n, state }) => ({
  'mod+enter':
    state.previewing || state.confirmingLargeChange
      ? { label: i18n.keys.apply, send: state.previewing ? 'apply' : 'confirm', when: acl.allowed }
      : { label: i18n.keys.next, send: 'next' },
});
