// What Storybook shows: every component folder below src/components, each with a story file the
// framework writes (framework/storybook/stories.mjs). Storybook (main.ts) and `npm run stories`
// read these same options.
export default {
  root: 'src',
  // The states gallery is a page of frames, each a page of the app's own shell (`#/states/…`),
  // which Storybook does not have; each of those states is a story here.
  skip: ['components/states'],
}
