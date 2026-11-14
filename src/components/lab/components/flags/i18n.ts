// The flags tab's words, in English. Translations: i18n/<locale>.json.
export default {
  label: 'Feature flags',
  intro:
    "How each flag is served, as GrowthBook's dashboard would choose. Until its key is in the build, OpenFeature's in-memory provider serves them. A change reaches every tab, and renders only the components that read that flag.",
  value: 'For you: {value}',
  on: 'on',
  off: 'off',
  flags: {
    stockCount: { name: 'Stock count in the rows', ways: { admins: 'Admins only', everyone: 'Everyone', nobody: 'Nobody' } },
    deletions: { name: 'Deletions', ways: { on: 'On', off: 'Paused' } },
    largeChangeAt: { name: 'Bulk change asks again above', ways: { moderators: 'Moderators at 10%, others at 50%', usual: 'Everyone at 50%', soon: 'Everyone at 10%' } },
  },
}
