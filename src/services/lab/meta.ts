export default ({ services: { lab } }) => ({
  change: { invalidates: [lab.settings] },
  settings: { reads: true },
});
