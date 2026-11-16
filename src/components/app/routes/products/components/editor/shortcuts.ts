// The editor's key. The chart decides when it works: a read-only editor's chart has no `save`,
// and a running save takes none, so the key does nothing then, and the list of keys says so.
export default ({ i18n }) => ({
  'mod+s': { label: i18n.keys.save, send: 'save' },
});
