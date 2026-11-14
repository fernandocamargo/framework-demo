// Every key on screen, grouped by the component folder that declares it, from what the framework
// keeps of each shortcuts.ts: translated, and whether it does something now.
export type Props = { onClose: () => void }

export default ({ i18n, keyboard, onClose }) => ({
  i18n,
  onClose,
  groups: keyboard.groups.map(({ path, shortcuts }) => ({ file: `${path}/shortcuts.ts`, shortcuts })),
})

/** What a parent passes, for each story Storybook shows of this folder (framework/storybook). */
export const examples = {
  'The keys on screen': { props: { onClose: () => undefined } },
}
