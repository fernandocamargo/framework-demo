export default ({ services: { lab } }) => ({
  settings: { reads: true },
  change: { invalidates: [lab.settings] },
})
